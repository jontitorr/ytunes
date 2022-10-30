import {
  failed,
  finished,
  nearlyFinished,
  started,
  stopped,
} from "./audioplayer";
import { logger } from "./logger";
import { Player, SkipDirection } from "./player";
import {
  buildAudioOrVideoResponse,
  buildCardlessAudioSpeechletResponse,
  buildCardlessSpeechletResponse,
  buildResponse,
  buildSpeechletResponse,
  buildStopSpeechletResponse,
} from "./responses";
import {
  getStrings,
  setStrings,
  StringsDE,
  StringsEN,
  StringsES,
  StringsFR,
  StringsIT,
  StringsJA,
  StringsPT,
} from "./strings";
import { AlexaEvent } from "./types";
import { doNothing, parseTime, shortResponse } from "./util";
import {
  getChannelTracks,
  getMyPlaylistTracks,
  getPlaylistTracks,
  getTracks,
  myLatestVideos,
} from "./youtube";

// --------------- Events ------------------

export const handler = async (event: AlexaEvent) => {
  logger.debug("Received Event:", JSON.stringify(event, null, 2));

  switch (event.request.locale.slice(0, 2)) {
  case "fr":
    setStrings({ ...StringsEN, ...StringsFR });
    break;
  case "it":
    setStrings({ ...StringsEN, ...StringsIT });
    break;
  case "de":
    setStrings({ ...StringsEN, ...StringsDE });
    break;
  case "es":
    setStrings({ ...StringsEN, ...StringsES });
    break;
  case "ja":
    setStrings({ ...StringsEN, ...StringsJA });
    break;
  case "pt":
    setStrings({ ...StringsEN, ...StringsPT });
    break;
  default:
    setStrings(StringsEN);
    break;
  }

  const supportsVideo = Boolean(
    event.context.System.device.supportedInterfaces.VideoApp &&
      event.request.intent.name === "PlayOneIntent"
  );

  const response = await (async () => {
    switch (event.request.type) {
    case "LaunchRequest":
      return getWelcomeResponse();
    case "IntentRequest":
      return onIntent(event, supportsVideo);
    case "SessionEndedRequest":
      logger.info("Alexa Session Ended");
      break;
    }

    if (event.request.type.startsWith("AudioPlayer")) {
      return handlePlayback(event, supportsVideo);
    }
  })();

  if (!response) {
    return;
  }

  logger.debug("Sending response");
  logger.debug(JSON.stringify(response, null, 2));

  return response;
};

const searchIntents = [
  "PlaylistIntent",
  "ShufflePlaylistIntent",
  "SearchMyPlaylistsIntent",
  "ShuffleMyPlaylistsIntent",
  "ChannelIntent",
  "ShuffleChannelIntent",
  "PlayMyLatestVideoIntent",
  "SearchIntent",
  "PlayOneIntent",
  "ShuffleIntent",
];

const onIntent = async (event: AlexaEvent, supportsVideo: boolean) => {
  if (!event.request.intent.name) {
    return shortResponse(getStrings().gonewrong, true);
  }

  const { name: intentName } = event.request.intent as { name: string };

  if (searchIntents.includes(intentName)) {
    return search(event, supportsVideo);
  }

  switch (intentName) {
  case "NextPlaylistIntent":
    return nextPlaylist(event, supportsVideo);
  case "SkipForwardIntent":
    return skip(event, SkipDirection.Forward, supportsVideo);
  case "SkipBackwardIntent":
    return skip(event, SkipDirection.Backward, supportsVideo);
  case "SkipToIntent":
    return skip(event, SkipDirection.None, supportsVideo);
  case "SayTimestampIntent":
    return sayTimestamp(event);
  case "AutoplayOffIntent":
    return togglePlayerState(event, "autoplay", false, supportsVideo);
  case "AutoplayOnIntent":
    return togglePlayerState(event, "autoplay", true, supportsVideo);
  case "AMAZON.YesIntent":
    return yesIntent(event, supportsVideo);
  case "AMAZON.NoIntent":
    return doNothing();
  case "AMAZON.HelpIntent":
    return getHelp();
  case "AMAZON.CancelIntent":
    return doNothing();
  case "AMAZON.PreviousIntent":
    return skipAction(event, SkipDirection.Backward, supportsVideo);
  case "AMAZON.NextIntent":
    return skipAction(event, SkipDirection.Forward, supportsVideo);
  case "AMAZON.ShuffleOnIntent":
    return togglePlayerState(event, "shuffle", true, supportsVideo);
  case "AMAZON.ShuffleOffIntent":
    return togglePlayerState(event, "shuffle", false, supportsVideo);
  case "AMAZON.ResumeIntent":
    return resume(event, 0, supportsVideo);
  case "AMAZON.RepeatIntent":
    return sayVideoTitle(event, supportsVideo);
  case "NowPlayingIntent":
    return sayVideoTitle(event, supportsVideo);
  case "AMAZON.LoopOnIntent":
    return togglePlayerState(event, "loop", true, supportsVideo);
  case "AMAZON.LoopOffIntent":
    return togglePlayerState(event, "loop", false, supportsVideo);
  case "AMAZON.StartOverIntent":
    return startOver(event, supportsVideo);
  case "AMAZON.StopIntent":
    return stop();
  case "AMAZON.PauseIntent":
    return stop();
  case "PlayMoreLikeThisIntent":
    return playMoreLikeThis(event, supportsVideo);
  }
  throw Error("Invalid Intent");
};

/// Handles non-customer-initiated AudioPlayer requests. For these events, we will be relying on the "token" and "offsetInMilliseconds" properties to be in the request object, rather than the context object.
const handlePlayback = (event: AlexaEvent, supportsVideo: boolean) => {
  const { request } = event;
  switch (request.type) {
  case "AudioPlayer.PlaybackStarted":
    return started(event);
  case "AudioPlayer.PlaybackFinished":
    return finished();
  case "AudioPlayer.PlaybackStopped":
    return stopped(event);
  case "AudioPlayer.PlaybackNearlyFinished":
    return nearlyFinished(event, supportsVideo);
  case "AudioPlayer.PlaybackFailed":
    return failed(event, supportsVideo);
  }
};

// --------------- Functions that control the skill's behavior ------------------

const getWelcomeResponse = async () => {
  return buildResponse(
    buildCardlessSpeechletResponse(
      `<speak>${getStrings().welcome1}</speak>`,
      getStrings().welcome2,
      false,
      "SSML"
    )
  );
};

const getHelp = () => {
  return buildResponse(
    buildSpeechletResponse("YouTube Help", getStrings().help, "", false)
  );
};

/**
 * Function that is ran when the user says "yes" to a prompt. This intent is used by the search function when prompting the user to try playing another video in the event of an error. We essentially cache the last search result known as the field "sr" and continue incrementing the index until we find a playable video.
 * @param event The Alexa event object.
 * @param supportsVideo Whether or not the user supports video output.
 * @returns The response object.
 */
const yesIntent = (event: AlexaEvent, supportsVideo: boolean) => {
  if (!event.session) {
    return shortResponse(getStrings().gonewrong, true);
  }

  const { attributes } = event.session;

  if (!("intent" in attributes) || !("sr" in attributes)) {
    return shortResponse(getStrings().gonewrong, true);
  }

  attributes.sr = (attributes.sr as number) + 1;

  return search(event, supportsVideo);
};

const nextPlaylist = (event: AlexaEvent, supportsVideo: boolean) => {
  logger.info(event.request.intent);

  if (!event.context.AudioPlayer?.token) {
    return shortResponse(getStrings().nothingplaying, true);
  }

  const player = new Player(event.context.AudioPlayer.token);

  if (!event.session || !player.query) {
    return shortResponse(getStrings().gonewrong, true);
  }

  const { attributes } = event.session;

  attributes.sr = player.searchResult + 1;
  attributes.query = player.query.replace(/ /g, "_");

  return search(event, supportsVideo);
};

const search = async (event: AlexaEvent, supportsVideo: boolean) => {
  if (!event.session) {
    return shortResponse(getStrings().gonewrong, true);
  }

  const { intent } = event.request;
  const { name: intentName } = intent;
  const attributes = event.session.attributes || { sr: 0, intent };

  const [query, firstTime] = (() => {
    if (attributes.query) {
      return [(attributes.query as string).replace(/_/g, " "), false];
    }
    if (intent.slots.query) {
      return [intent.slots.query.value.toLowerCase(), true];
    }
    return ["", false];
  })();

  // We will be using the "sr" attribute to keep track of the index of the search result we are currently on. This is useful for events where we need to skip to the next video in the search result.

  if (!("sr" in attributes)) {
    attributes.sr = 0;
  }

  const sr = attributes.sr as number;
  const player = new Player(
    `q=${
      firstTime ? query.replace(/ /g, "_") : query
    }&sr=${sr}&i=${intentName.replace("Intent", "")}`
  );

  if (
    intentName === "ShuffleIntent" ||
    intentName === "ShufflePlaylistIntent" ||
    intentName === "ShuffleChannelIntent" ||
    intentName === "ShuffleMyPlaylistsIntent"
  ) {
    player.shuffle = true;
  }

  // If we still cannot find any videos, we will have to report an error to the user.
  let errorMessage = "";
  let playlistTitle = "";
  let tracks: string[] = [];

  if (
    intentName === "PlaylistIntent" ||
    intentName === "ShufflePlaylistIntent" ||
    intentName === "NextPlaylistIntent"
  ) {
    [tracks, playlistTitle, errorMessage] = await getPlaylistTracks(query, sr);
  } else if (
    intentName === "SearchMyPlaylistsIntent" ||
    intentName === "ShuffleMyPlaylistsIntent"
  ) {
    [tracks, playlistTitle, errorMessage] = await getMyPlaylistTracks(
      query,
      sr
    );
  } else if (
    intentName === "ChannelIntent" ||
    intentName === "ShuffleChannelIntent"
  ) {
    [tracks, playlistTitle, errorMessage] = await getChannelTracks(query, sr);
  } else if (intentName === "PlayMyLatestVideoIntent") {
    tracks = await myLatestVideos();
  } else {
    tracks = await getTracks(query);
  }

  if (!tracks.length) {
    return shortResponse(errorMessage || getStrings().gonewrong, true);
  }

  const [trackUrl, trackTitle] = await player.addTracks(tracks, supportsVideo);

  if (!trackUrl) {
    // TODO: Can be replaced by a more efficient error handling method. For example, we can utilize sr to search for batches of 50 videos in the event of an error for getTracks().
    if (
      [...searchIntents.slice(0, 5), "NextPlaylistIntent"].includes(intentName)
    ) {
      attributes.sr = sr + 1;
      return buildResponse(
        buildCardlessSpeechletResponse(
          "",
          `${playlistTitle} ${getStrings().notworked}`,
          false
        ),
        attributes
      );
    }

    return shortResponse(getStrings().gonewrong, true);
  }

  return buildResponse(
    buildAudioOrVideoResponse(
      "YouTube",
      `${getStrings().playing} ${playlistTitle || trackTitle}`,
      true,
      trackUrl,
      player.toString(),
      0,
      supportsVideo
    )
  );
};

const stop = () => {
  return buildResponse(buildStopSpeechletResponse(getStrings().pausing, true));
};

const playMoreLikeThis = async (event: AlexaEvent, supportsVideo: boolean) => {
  if (!event.context.AudioPlayer?.token) {
    return shortResponse(getStrings().nothingplaying, true);
  }

  const { token } = event.context.AudioPlayer;
  const player = new Player(token);
  const nowPlayingId = player.queue[player.currentTrack];
  const similarTracks = await getTracks("", nowPlayingId);

  if (!similarTracks.length) {
    //TODO: Add a "could not find similar videos" or similar response string.
    return shortResponse(getStrings().noplaylistresults, true);
  }

  const [trackUrl, trackTitle] = await player.addTracks(
    similarTracks,
    supportsVideo
  );

  if (!trackUrl) {
    return shortResponse(getStrings().throttled, true);
  }

  return buildResponse(
    buildCardlessAudioSpeechletResponse(
      `${getStrings().playing} ${trackTitle}`,
      true,
      trackUrl,
      player.toString()
    )
  );
};

const skipAction = async (
  event: AlexaEvent,
  skip: SkipDirection,
  supportsVideo: boolean
) => {
  if (!event.context.AudioPlayer?.token) {
    return shortResponse(getStrings().nothingplaying, true);
  }

  const { token } = event.context.AudioPlayer;
  const player = new Player(token);
  const [trackUrl, title] = await player.skipTrack(skip, supportsVideo);

  if (!trackUrl) {
    return shortResponse(getStrings().nomoreitems, true);
  }

  return buildResponse(
    buildCardlessAudioSpeechletResponse(
      `${getStrings().playing} ${title}`,
      true,
      trackUrl,
      player.toString()
    )
  );
};

const skip = async (
  event: AlexaEvent,
  skipDirection: SkipDirection,
  supportsVideo: boolean
) => {
  if (!event.context.AudioPlayer?.token) {
    return shortResponse(getStrings().nothingplaying, true);
  }

  const skipErrorOutput = (() => {
    switch (skipDirection) {
    case SkipDirection.Forward:
    case SkipDirection.Backward:
      return getStrings().sorryskipby;
    case SkipDirection.None: // We skip to a specific point.
      return getStrings().sorryskipto;
    }
  })();

  if (!event.request.intent?.slots) {
    return shortResponse(skipErrorOutput, true);
  }

  const [hours, minutes, seconds] = parseTime(event.request.intent.slots);

  if (hours < 0 || minutes < 0 || seconds < 0) {
    return shortResponse(skipErrorOutput, true);
  }

  const offsetInMilliseconds =
    hours * 3600000 + minutes * 60000 + seconds * 1000;

  if (skipDirection === SkipDirection.None) {
    return resume(event, offsetInMilliseconds, supportsVideo);
  }

  const currentOffsetInMilliseconds =
    event.context.AudioPlayer?.offsetInMilliseconds || 0;

  return resume(
    event,
    currentOffsetInMilliseconds + offsetInMilliseconds * skipDirection,
    supportsVideo
  );
};

const resume = async (
  event: AlexaEvent,
  offsetInMilliseconds: number,
  supportsVideo: boolean
) => {
  if (!event.context.AudioPlayer?.token) {
    return getWelcomeResponse();
  }

  const { token } = event.context.AudioPlayer;
  const player = new Player(token);
  let speechOutput = getStrings().ok;

  if (!offsetInMilliseconds) {
    speechOutput = getStrings().resuming;
    offsetInMilliseconds = event.context.AudioPlayer.offsetInMilliseconds ?? 0;
  }

  const [trackUrl] = await player.skipTrack(SkipDirection.None, supportsVideo);

  if (!trackUrl) {
    return shortResponse(getStrings().noresume, true);
  }

  return buildResponse(
    buildCardlessAudioSpeechletResponse(
      speechOutput,
      true,
      trackUrl,
      token,
      offsetInMilliseconds
    )
  );
};

const togglePlayerState = async (
  event: AlexaEvent,
  mode: string,
  value: boolean,
  supportsVideo: boolean
) => {
  if (!event.context.AudioPlayer?.token) {
    return shortResponse(getStrings().nothingplaying, true);
  }

  const player = new Player(event.context.AudioPlayer.token);

  Object.assign(player, { [mode]: value });

  const [trackUrl] = await player.skipTrack(SkipDirection.None, supportsVideo);

  return buildResponse(
    buildCardlessAudioSpeechletResponse(
      getStrings().ok,
      true,
      trackUrl,
      player.toString(),
      event.context.AudioPlayer?.offsetInMilliseconds ?? 0
    )
  );
};

const startOver = async (event: AlexaEvent, supportsVideo: boolean) => {
  if (!event.context.AudioPlayer?.token) {
    return shortResponse(getStrings().nothingplaying, true);
  }

  const player = new Player(event.context.AudioPlayer.token);
  const [trackUrl, title] = await player.skipTrack(
    SkipDirection.None,
    supportsVideo
  );

  if (!trackUrl) {
    return shortResponse(getStrings().novideo, true);
  }

  return buildResponse(
    buildCardlessAudioSpeechletResponse(
      `${getStrings().playing} ${title}`,
      true,
      trackUrl,
      player.toString()
    )
  );
};

const sayVideoTitle = async (event: AlexaEvent, supportsVideo: boolean) => {
  if (!event?.context?.AudioPlayer?.token) {
    return shortResponse(getStrings().nothingplaying, true);
  }

  const player = new Player(event.context.AudioPlayer.token);
  const [, title] = await player.skipTrack(SkipDirection.None, supportsVideo);

  return shortResponse(
    title ? `${getStrings().nowplaying} ${title}` : getStrings().notitle,
    true
  );
};

const sayTimestamp = (event: AlexaEvent) => {
  if (!event.context.AudioPlayer?.offsetInMilliseconds) {
    return shortResponse(getStrings().nothingplaying, true);
  }

  const currentOffsetInMilliseconds =
    event.context.AudioPlayer.offsetInMilliseconds;
  const hours = currentOffsetInMilliseconds / 3600000;
  const minutes = (currentOffsetInMilliseconds - hours * 3600000) / 60000;
  const seconds =
    (currentOffsetInMilliseconds - hours * 3600000 - minutes * 60000) / 1000;
  let speechOutput = getStrings().currentposition;

  if (hours > 0) {
    speechOutput += ` ${hours.toString()} ${
      hours === 1 ? getStrings().hour : getStrings().hours
    }, `;
  }
  if (minutes > 0) {
    speechOutput += ` ${minutes.toString()} ${
      minutes === 1 ? getStrings().minute : getStrings().minutes
    }, `;
  }

  speechOutput += ` ${seconds.toString()} ${
    seconds === 1 ? getStrings().second : getStrings().seconds
  }`;

  return shortResponse(speechOutput, true);
};
