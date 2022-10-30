import { logger } from "./logger";
import { Player, SkipDirection } from "./player";
import { buildAudioEnqueueResponse, buildResponse } from "./responses";
import { doNothingAudio } from "./util";

import type { AlexaEvent } from "./types";

export const started = async (event: AlexaEvent) => {
  if (!event.request.token) {
    return doNothingAudio();
  }

  logger.info("Audio playback started");

  return doNothingAudio();
};

export const finished = () => {
  logger.info("Audio playback Finished");
  return doNothingAudio();
};

export const stopped = (event: AlexaEvent) => {
  const { offsetInMilliseconds } = event.request;
  logger.info(`Audio playback stopped at ${offsetInMilliseconds}`);
  return doNothingAudio();
};

/**
 * Enqueues the next video in the queue, if there is one.
 * @param event The Alexa event.
 * @param supportsVideo Whether or not the user supports video output.
 * @returns A response to the Alexa event.
 */
const nearlyFinished = async (event: AlexaEvent, supportsVideo: boolean) => {
  const { token } = event.request;

  if (!token) {
    return doNothingAudio();
  }

  const player = new Player(token);

  if (!player.autoplay) {
    return doNothingAudio();
  }

  const [trackUrl] = await player.skipTrack(
    SkipDirection.Forward,
    supportsVideo
  );

  if (!trackUrl) {
    return doNothingAudio();
  }

  return buildResponse(
    buildAudioEnqueueResponse(true, trackUrl, token, player.toString())
  );
};

/**
 * Run when the AudioPlayer.PlaybackFailed event is received. Will log the error, and attempt to play the next video in the queue.
 * @param event The Alexa event.
 * @param supportsVideo Whether or not the user supports video output.
 * @returns A response to the Alexa event.
 */
const failed = async (event: AlexaEvent, supportsVideo: boolean) => {
  logger.error("Playback Failed");

  if (event.request.error) {
    logger.error(event.request.error);
  }

  const { token } = event.request;

  if (!token) {
    return doNothingAudio();
  }

  const player = new Player(token);
  const [trackUrl] = await player.skipTrack(
    SkipDirection.Forward,
    supportsVideo
  );

  if (!trackUrl) {
    return doNothingAudio();
  }

  // Will attempt to play the next song.
  return buildResponse(
    buildAudioEnqueueResponse(
      true,
      trackUrl,
      token,
      player.toString(),
      "REPLACE_ALL"
    )
  );
};

export { failed, nearlyFinished };
