import fuzz from "fuzzball";
import fetch from "node-fetch";
import ytdl from "ytdl-core";

import { logger } from "./logger";
import { getStrings } from "./strings";

if (!process.env.API_KEY) {
  throw new Error("Missing YouTube API_KEY, please set it in the environment");
}

const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_API_KEY = process.env.API_KEY;

enum YoutubeSearchType {
  Videos = "/videos",
  Playlists = "/playlists",
  Channels = "/channels",
  Search = "/search",
  PlaylistItems = "/playlistItems",
}

const buildYouTubeUrl = (
  path: YoutubeSearchType,
  query?: Map<string, string>
) => {
  const url = new URL(YOUTUBE_API_BASE_URL + path);

  query &&
    query.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

  url.searchParams.append("key", YOUTUBE_API_KEY);

  const ret = url.toString();
  logger.debug(`Built YouTube URL: ${ret}`);

  return ret;
};

interface YoutubeSearchResult {
  items?: {
    ratio: number;
    id: { channelId?: string; videoId?: string; playlistId?: string };
    snippet: { title: string; thumbnails: { medium: { url: string } } };
  }[];
  nextPageToken?: string;
}

export enum YoutubeResourceType {
  Video = "video",
  Playlist = "playlist",
  Channel = "channel",
}

/**
 *  Returns a list of resources that match the query. This can be a collection of videos, playlists, or channels.
 * @param query The search query.
 * @param searchType The value is a comma-separated list of resource types. The default value is video,channel,playlist.
 * @param maxResults The maximum number of items that should be returned in the result set. Acceptable values are 0 to 50, inclusive. The default value is 5.
 * @param options The options for the search.
 * @returns A list of resources that match the query.
 */
const searchYoutube = async (
  query: string,
  searchType: YoutubeResourceType,
  maxResults: number,
  options: {
    relatedToVideoId?: string;
    channelId?: string;
    order?: string;
    pageToken?: string;
  } = {}
): Promise<YoutubeSearchResult> => {
  const { relatedToVideoId, channelId, order, pageToken } = options;
  const params = new Map<string, string>();

  params.set("q", query);
  params.set("type", searchType);

  maxResults > 0 &&
    maxResults <= 50 &&
    maxResults !== 5 &&
    params.set("maxResults", maxResults.toString());

  params.set("part", "id,snippet");

  channelId && params.set("channelId", channelId);
  order && params.set("order", order);
  pageToken && params.set("pageToken", pageToken);
  relatedToVideoId && params.set("relatedToVideoId", relatedToVideoId);

  const res = await fetch(buildYouTubeUrl(YoutubeSearchType.Search, params));
  const data = await res.json();

  if (res.status === 200) {
    return data as YoutubeSearchResult;
  }

  return {};
};

/**
 * Fetches playlists that belong to a channel.
 * @param channelId The ID of the channel.
 * @param maxResults The maximum number of items that should be returned in the result set. Acceptable values are 0 to 50, inclusive. The default value is 5.
 * @param pageToken The token that specifies the result page that should be returned.
 * @returns A list of playlists that belong to a channel.
 */
const getChannelPlaylists = async (
  channelId: string,
  maxResults: number,
  pageToken = ""
): Promise<
  {
    /// Not actually included in the response, but added for integrated fuzzy matching.
    ratio: number;
    id: string;
    snippet: { title: string };
  }[]
> => {
  const params = new Map<string, string>();

  maxResults > 0 &&
    maxResults <= 50 &&
    maxResults !== 5 &&
    params.set("maxResults", maxResults.toString());

  params.set("channelId", channelId);
  params.set("pageToken", pageToken);
  params.set("part", "snippet");

  const res = await fetch(buildYouTubeUrl(YoutubeSearchType.Playlists, params));
  const data = await res.json();

  if (res.status === 200) {
    return data as {
      ratio: number;
      id: string;
      snippet: { title: string };
    }[];
  }

  return [];
};

interface YoutubePlaylistItemsSearchResult {
  items?: {
    snippet: { resourceId: { videoId: string } };
  }[];
  nextPageToken?: string;
}

const searchYouTubePlaylistItems = async (
  playlistId: string,
  pageToken = ""
) => {
  const params = new Map<string, string>();

  params.set("maxResults", "50");
  params.set("playlistId", playlistId);
  params.set("part", "snippet");

  pageToken && params.set("pageToken", pageToken);

  const res = await fetch(
    buildYouTubeUrl(YoutubeSearchType.PlaylistItems, params)
  );
  const data = await res.json();

  if (res.status === 200) {
    return data as YoutubePlaylistItemsSearchResult;
  }

  return {};
};

/**
 * Searches for a YouTube channel by username.
 * @param username  The username of the channel.
 * @param maxResults  The maximum number of items that should be returned in the result set. Acceptable values are 0 to 50, inclusive. The default value is 5.
 * @returns  A list of channels that match the query.
 */
const getYouTubeChannels = async (
  username: string,
  maxResults = 5
): Promise<
  {
    id: string;
  }[]
> => {
  const params = new Map<string, string>();

  maxResults > 0 &&
    maxResults <= 50 &&
    maxResults !== 5 &&
    params.set("maxResults", maxResults.toString());

  params.set("forUsername", username);
  params.set("part", "id");

  const res = await fetch(buildYouTubeUrl(YoutubeSearchType.Channels, params));
  const data = await res.json();

  if (res.status === 200) {
    return data as { id: string }[];
  }

  return [];
};

/**
 * Returns a list of tracks that match the query.
 * @param query The search query.
 * @param relatedToVideoId Returns a list of tracks that are related to the video that the parameter value identifies.
 * @param channelId Returns a list of tracks uploaded to the channel specified by the channel ID.
 * @returns A list of tracks that match the query.
 */
const getTracks = async (
  query: string,
  relatedToVideoId = "",
  channelId = ""
): Promise<string[]> => {
  logger.info(`Searching for tracks with query: ${query}`);

  const searchResult = await searchYoutube(
    query,
    YoutubeResourceType.Video,
    50,
    {
      relatedToVideoId,
      channelId,
    }
  );

  logger.debug(`Search result: ${JSON.stringify(searchResult, null, 2)}`);

  if (!searchResult.items || !searchResult.items.length) {
    return [];
  }

  return searchResult.items
    .filter((item) => Boolean(item.id.videoId))
    .map((item) => item.id.videoId ?? "");
};

/**
 * Searches for a playlist given a query, and returns a tuple containing the tracks from the playlist, if any, the playlist title, and a speech output string Also takes the current search result index which indicates that all playlists prior to that index have already been searched and must be skipped. If the index is 0, all results are searched.
 * @param playlistName The name of the playlist to search for.
 * @param sr The current search result index.
 * @returns A tuple containing the tracks from the playlist, if any, the playlist title, and a speech output string.
 */
const getPlaylistTracks = async (
  playlistName: string,
  sr: number
): Promise<[string[], string, string]> => {
  const searchResponse = await searchYoutube(
    playlistName,
    YoutubeResourceType.Playlist,
    10
  );

  if (!searchResponse.items || !searchResponse.items.length) {
    return [[], "", getStrings().noplaylistresults];
  }
  if (sr > searchResponse.items.length) {
    return [[], "", getStrings().nomoreplaylists];
  }
  for (let i = sr; i < searchResponse.items.length; i++) {
    const playlist = searchResponse.items[i];
    const { playlistId } = playlist.id;

    if (!playlistId) {
      continue;
    }

    const { title: playlistTitle } = playlist.snippet;
    const tracks = await getTracksFromPlaylist(playlistId);

    return [tracks.slice(0, 50), playlistTitle, ""];
  }

  return [[], "", getStrings().nomoreplaylists];
};

const getTracksFromPlaylist = async (playlistId: string) => {
  const tracks: string[] = [];
  let data: YoutubePlaylistItemsSearchResult = { nextPageToken: "" };

  while ("nextPageToken" in data && tracks.length < 100) {
    const { nextPageToken } = data;
    data = await searchYouTubePlaylistItems(playlistId, nextPageToken);

    if (!data.items || !data.items.length) {
      continue;
    }

    for (const item of data.items) {
      tracks.push(item.snippet.resourceId.videoId);
    }
  }
  return tracks;
};

/**
 * Searches for a tracks found on a playlist belonging to the MY_CHANNEL_ID variable provided. Returns a tuple containing the tracks from the playlist, the playlist title, and a speech output string. Also takes the current search result index which indicates that all playlists prior to that index have already been searched and must be skipped. If the index is 0, all results are searched.
 * @param query The name of the playlist to search for.
 * @param sr The current search result index.
 * @returns A tuple containing the tracks from the playlist, the playlist title, and a speech output string.
 */
const getMyPlaylistTracks = async (
  query: string,
  sr: number
): Promise<[string[], string, string]> => {
  const channelId = process.env.MY_CHANNEL_ID ?? "";

  // Attempt to search for our playlist from the query. Equivalent to using the search bar.
  const playlists = await getChannelPlaylists(channelId, 10);

  if (!playlists.length) {
    return [[], "", getStrings().noplaylistresults];
  }
  if (sr > playlists.length) {
    return [[], "", getStrings().nomoreplaylists];
  }

  playlists.forEach((playlist) => {
    playlist.ratio = fuzz.ratio(
      query.toLowerCase(),
      playlist.snippet.title.toLowerCase()
    );
  });

  playlists.sort((a, b) => b.ratio - a.ratio);

  const playlist = playlists[sr];
  const { id: playlistId } = playlist;
  const { title: playlistTitle } = playlist.snippet;
  const tracks: string[] = [];
  let data: YoutubePlaylistItemsSearchResult = { nextPageToken: "" };

  while ("nextPageToken" in data && tracks.length < 100) {
    const { nextPageToken } = data;
    data = await searchYouTubePlaylistItems(playlistId, nextPageToken);

    if (!data.items || !data.items.length) {
      continue;
    }

    for (const item of data.items) {
      tracks.push(item.snippet.resourceId.videoId);
    }
  }

  return [tracks.slice(0, 50), playlistTitle, ""];
};

/**
 * Searches a channel for tracks and returns a tuple containing the tracks, if any, the channel title, and a speech output string. Also takes the current search result index which indicates that all channels prior to that index have already been searched and must be skipped. If the index is 0, all results are searched.
 * @param query The name of the channel to search for.
 * @param sr The current search result index.
 * @returns A tuple containing the tracks, if any, the channel title, and a speech output string.
 */
const getChannelTracks = async (
  query: string,
  sr: number
): Promise<[string[], string, string]> => {
  const searchResponse = await searchYoutube(
    query,
    YoutubeResourceType.Channel,
    10
  );

  if (!searchResponse.items || !searchResponse.items.length) {
    return [[], "", getStrings().youtubeerror];
  }
  if (sr > searchResponse.items.length) {
    return [[], "", getStrings().youtubeerror];
  }

  const channelId = searchResponse.items[sr].id.channelId;

  if (!channelId) {
    return [[], "", getStrings().youtubeerror];
  }

  const playlistTitle = searchResponse.items[sr].snippet.title;
  let data: YoutubeSearchResult = { nextPageToken: "" };
  const tracks: string[] = [];

  while ("nextPageToken" in data && tracks.length < 100) {
    const { nextPageToken } = data;
    data = await searchYoutube(query, YoutubeResourceType.Video, 50, {
      channelId,
      pageToken: nextPageToken,
    });

    if (!data.items || !data.items.length) {
      continue;
    }
    for (const item of searchResponse.items) {
      if (item.id.videoId) {
        tracks.push(item.id.videoId);
      }
    }
  }

  return [tracks.slice(0, 50), playlistTitle, ""];
};

/**
 * Retrieves the video's URL and title from the video ID. provided.
 * @param id The video ID.
 * @param supportsVideo Whether or not the user supports video output.
 * @returns A tuple containing the video URL and title.
 */
const getUrlAndTitle = async (
  id: string,
  supportsVideo: boolean
): Promise<[string, string]> => {
  logger.info(
    `Getting youtube-dl url for https://www.youtube.com/watch?v=${id}`
  );

  try {
    const ytUrl = `https://www.youtube.com/watch?v=${id}`;
    const info = await ytdl.getInfo(ytUrl);

    if (info.videoDetails.isLiveContent) {
      return [info.videoDetails.video_url, info.videoDetails.title];
    }
    for (const format of info.formats) {
      if (!supportsVideo && !format.videoCodec) {
        return [format.url, info.videoDetails.title];
      }
      if (supportsVideo && format.videoCodec && format.audioCodec) {
        return [format.url, info.videoDetails.title];
      }
    }

    logger.error(`Unable to get URL for ${id}`);

    return ["", ""];
  } catch (err) {
    logger.error(`Unable to get URL for ${id}: ${err}`);

    return ["", ""];
  }
};

/**
 * Retrieves the title of a YouTube resource, whether it be a video, playlist, or channel.
 * @param id The ID of the resource.
 * @param resourceType The type of resource.
 * @returns An object containing the title of the resource, if any, and an error, if any.
 */
const getResourceTitle = async (
  id: string,
  resourceType: YoutubeResourceType
): Promise<string> => {
  if (!id) {
    return "";
  }

  const params = new Map<string, string>();

  params.set("part", "snippet");
  params.set("id", id);

  const searchType = (() => {
    switch (resourceType) {
    case YoutubeResourceType.Video:
      return YoutubeSearchType.Videos;
    case YoutubeResourceType.Playlist:
      return YoutubeSearchType.Playlists;
    case YoutubeResourceType.Channel:
      return YoutubeSearchType.Channels;
    }
  })();

  const res = await fetch(buildYouTubeUrl(searchType, params));
  const data = await res.json();

  if (res.status === 200 && data.items && data.items.length > 0) {
    return data.items[0].snippet.title;
  }

  return "";
};

/**
 * Returns a tuple containing the tracks from the YouTube URL, a speech output string, and optionally a playlist title, if the URL was a playlist URL. The URL can be a playlist, channel, or video.
 * @param url The YouTube URL, which can be of a playlist, channel, or video.
 * @returns  A tuple containing the tracks from the Youtube URL, a speech output string, and optionally a playlist title, if the URL was a playlist URL.
 */
const getTracksFromUrl = async (
  url: string
): Promise<[string[], string, string]> => {
  let t = url.match(/youtube.com\/watch\?v=.*&list=([^&]+)/);

  const scrapePlaylist = async (
    t: RegExpMatchArray
  ): Promise<[string[], string, string]> => {
    const playlistId = t[1];
    const playlistTitle = await getResourceTitle(
      playlistId,
      YoutubeResourceType.Playlist
    );
    const tracks = await getTracksFromPlaylist(playlistId);

    if (!playlistTitle) {
      return [[], "", ""];
    }

    return [tracks, getStrings().playlist, playlistTitle];
  };

  if (t) {
    return scrapePlaylist(t);
  }

  t = url.match(/youtube.com\/playlist\?list=([^&]+)/);

  if (t) {
    return scrapePlaylist(t);
  }

  t = url.match(/youtube.com\/watch\?v=([^&]+)/);

  if (t) {
    const videoId = t[1];
    return [[videoId], getStrings().video, ""];
  }

  t = url.match(/youtu.be\/([^&]+)/);

  if (t) {
    const videoId = t[1];
    return [[videoId], getStrings().video, ""];
  }

  t = url.match(/youtube.com\/channel\/([^&]+)/);

  const scrapeChannel = async (
    channelId: string
  ): Promise<[string[], string, string]> => {
    const tracks = await getTracks("", "", channelId);
    const channelTitle = await getResourceTitle(
      channelId,
      YoutubeResourceType.Channel
    );

    if (!channelTitle) {
      return [[], "", ""];
    }

    return [tracks, getStrings().channel, channelTitle];
  };

  if (t) {
    return scrapeChannel(t[1]);
  }

  t = url.match(/youtube.com\/user\/([^&]+)/);

  if (t) {
    const username = t[1];
    const channels = await getYouTubeChannels(username, 1);

    if (!channels.length) {
      return [[], "", ""];
    }

    return scrapeChannel(channels[0].id);
  }

  return [[], getStrings().video, ""];
};

/**
 * Searches for your latest YouTube videos you've uploaded. MY_CHANNEL_ID must be set in your environment variables.
 * @returns A list of tracks.
 */
const myLatestVideos = async () => {
  if (!process.env.MY_CHANNEL_ID) {
    return [];
  }

  const searchResponse = await searchYoutube(
    "",
    YoutubeResourceType.Video,
    50,
    {
      channelId: process.env.MY_CHANNEL_ID,
      order: "date",
    }
  );

  if (!searchResponse.items || !searchResponse.items.length) {
    return [];
  }

  return searchResponse.items
    .filter((video) => Boolean(video.id.videoId))
    .map((video) => video.id.videoId ?? "");
};

export {
  getResourceTitle,
  getTracksFromUrl,
  getUrlAndTitle,
  myLatestVideos,
  getMyPlaylistTracks,
  getChannelTracks,
  getPlaylistTracks,
  getTracks,
};
