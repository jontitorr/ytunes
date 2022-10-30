import { shuffle } from "./util";
import { getUrlAndTitle } from "./youtube";

export enum SkipDirection {
  None,
  Forward,
  Backward = -1,
}

export class Player {
  public shuffle: boolean;
  public searchResult: number;
  public autoplay: boolean;
  public currentIntent: string;
  public query: string;
  public loop: boolean;
  public queue: string[];
  public currentTrack: number;

  constructor(token: string) {
    const deserializedToken = new Map<string, string>();

    token.split("&").forEach((i) => {
      const [key, val] = i.split("=");
      deserializedToken.set(key, val);
    });

    this.shuffle = deserializedToken.get("s") === "1";
    this.searchResult = parseInt(deserializedToken.get("sr") ?? "0");
    this.autoplay = (deserializedToken.get("a") ?? "1") === "1";
    this.currentIntent = deserializedToken.get("i") ?? "";
    this.query = (deserializedToken.get("q") ?? "").replace(/_/g, " ");
    this.loop = deserializedToken.get("l") === "1";
    this.queue = Array.from(deserializedToken.keys())
      .filter((key) => key.startsWith("v"))
      .map((key) => deserializedToken.get(key) ?? "");
    this.currentTrack = parseInt(deserializedToken.get("p") ?? "0");
  }

  /**
   * Adds a bunch of tracks to the queue. Returns the source URL and title of the first working track provided. This function will stop checking the validity of tracks once it finds a valid one. This is to prevent the user from having to wait for the entire queue to be checked.
   * @param tracks An array of track IDs.
   * @param supportsVideo Whether or not the user supports video output.
   * @returns A tuple containing the source URL, and title of the track, empty strings if none of the tracks were valid.
   */
  async addTracks(
    tracks: string[],
    supportsVideo: boolean
  ): Promise<[string, string]> {
    let trackUrlRet = "";
    let videoTitleRet = "";

    for (const track of tracks) {
      // Fetching the url and title of every track is a waste of time if we're not going to play it.
      if (!trackUrlRet) {
        const [url, title] = await getUrlAndTitle(track, supportsVideo);

        if (!url) {
          continue;
        }

        trackUrlRet = url;
        videoTitleRet = title;
      }

      this.queue.push(track);
    }

    return [trackUrlRet, videoTitleRet];
  }

  shuffleQueue() {
    shuffle(this.queue);
  }

  /**
   * Retrieves information about the next track in the queue. Essentially, our token was serialized such that we can embed an entire player into it, in the form of query parameters. This function will retrieve the source URL and new token declaring the changes of the player's state, as well as the title of the next video. It will return an empty string for the URL and title if there are no more videos in the queue.
   * @param direction The direction to skip in the queue.
   * @param supportsVideo Whether or not the user supports video output.
   * @returns A tuple containing the source URL, and title of the track, empty strings if there are no more tracks in the queue.
   */
  async skipTrack(
    direction: SkipDirection,
    supportsVideo: boolean
  ): Promise<[string, string]> {
    this.shuffle && this.shuffleQueue();

    let [badTrackStart, badTrackEnd] = [-1, -1];
    let nextTrack = this.currentTrack + direction;

    if (direction === SkipDirection.None) {
      return getUrlAndTitle(this.queue[nextTrack], supportsVideo);
    }

    const queueLength = this.queue.length;
    let title = "";
    let url = "";

    while (nextTrack != this.currentTrack) {
      if (nextTrack < 0) {
        if (!this.loop) {
          return ["", ""];
        }

        nextTrack = queueLength - 1;
      }
      if (nextTrack > queueLength) {
        if (!this.loop) {
          return ["", ""];
        }

        nextTrack = 0;
      }

      [url, title] = await getUrlAndTitle(this.queue[nextTrack], supportsVideo);

      if (url) {
        break;
      }
      if (badTrackStart === -1) {
        badTrackStart = nextTrack;
      }

      badTrackEnd = nextTrack;
      nextTrack += direction;
    }

    // Delete all bad tracks from the queue.
    if (badTrackStart !== -1) {
      const toDelete = badTrackEnd - badTrackStart + 1;
      this.queue.splice(badTrackStart, toDelete);
      nextTrack -= toDelete;
    }

    this.currentTrack = nextTrack;

    return [url, title];
  }

  /**
   * Serializes our playlist into an AudioPlayer token.
   * @return A serialized string.
   */
  toString() {
    //Serialize all of our fields into a token.
    const tokenList: string[] = [];

    this.shuffle && tokenList.push("s=1");
    this.searchResult && tokenList.push(`sr=${this.searchResult}`);
    this.autoplay && tokenList.push("a=1");
    this.currentIntent && tokenList.push(`i=${this.currentIntent}`);
    this.query && tokenList.push(`q=${this.query.replace(/ /g, "_")}`);
    this.loop && tokenList.push("l=1");
    this.queue.forEach((val, i) => {
      tokenList.push(`v${i}=${val}`);
    });
    this.currentTrack && tokenList.push(`p=${this.currentTrack}`);

    return tokenList.join("&");
  }
}
