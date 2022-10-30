import { buildResponse, buildShortSpeechletResponse } from "./responses";
import { getStrings } from "./strings";

import type { Response } from "./responses";

/**
 * Shuffles array in place. From: https://stackoverflow.com/a/2450976.
 *
 * @param {T[]} array The array to shuffle.
 * @return {T[]} The shuffled array.
 */
const shuffle = <T>(array: T[]): T[] => {
  let currentIndex = array.length;
  let randomIndex: number;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
};

/**
 * Extract the given hours, minutes, and seconds from the object, providing defaulted 0 values, if not present.
 *
 * @param {any} intentSlots The object to extract from.
 * @return {number[]} The hours, minutes, and seconds.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseTime = (intentSlots: any): number[] => {
  const hours = parseInt(intentSlots.hours?.value ?? "0");
  const minutes = parseInt(intentSlots.minutes?.value ?? "0");
  const seconds = parseInt(intentSlots.seconds?.value ?? "0");

  return [hours, minutes, seconds];
};

/**
 * Helper function for creating a short Alexa response.
 *
 * @param {string} output The output to speak.
 * @param {boolean} shouldEndSession Whether or not the session should end.
 * @return {Response} The response.
 */
const shortResponse = (output: string, shouldEndSession: boolean): Response => {
  return buildResponse(buildShortSpeechletResponse(output, shouldEndSession));
};

/**
 * Use for when you have to return a response to the Alexa, but you don't want to do anything.
 *
 * @return {Response} The empty response.
 */
const doNothing = (): Response => {
  return shortResponse("", true);
};

/**
 * Use for when you have to communicate to the user that this is an illegal request.
 *
 * @return {Response} The illegal request response.
 */
const illegalAction = (): Response => {
  return shortResponse(getStrings().illegal, false);
};

export { doNothing, illegalAction, shuffle, parseTime, shortResponse };
