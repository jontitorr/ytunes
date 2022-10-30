import { Card, OutputSpeech } from "./types";

interface CardlessSpeechletResponse {
  outputSpeech?: OutputSpeech;
  reprompt?: { outputSpeech: OutputSpeech };
  shouldEndSession: boolean;
}

export const buildCardlessSpeechletResponse = (
  output: string,
  repromptText = "",
  shouldEndSession = true,
  speechType = "PlainText"
): CardlessSpeechletResponse => {
  const textOrSsml = speechType === "SSML" ? "ssml" : "text";
  return {
    outputSpeech: { type: speechType, [textOrSsml]: output },
    reprompt: { outputSpeech: { type: "PlainText", text: repromptText } },
    shouldEndSession,
  };
};

type SpeechletResponse = CardlessSpeechletResponse & { card: Card };

export const buildSpeechletResponse = (
  title: string,
  output: string,
  repromptText: string,
  shouldEndSession: boolean
): SpeechletResponse => {
  return {
    ...buildCardlessSpeechletResponse(output, repromptText, shouldEndSession),
    card: { type: "Simple", title, content: output },
  };
};

interface AudioResponse {
  outputSpeech: OutputSpeech;
  directives: [
    {
      type: string;
      playBehavior: string;
      audioItem: {
        stream: {
          url: string;
          token: string;
          expectedPreviousToken?: string;
          offsetInMilliseconds: number;
        };
      };
    }
  ];
}

type AudioSpeechletResponse = SpeechletResponse & AudioResponse;

const buildAudioSpeechletResponse = (
  title: string,
  output: string,
  shouldEndSession: boolean,
  url: string,
  token: string,
  offsetInMilliseconds: number
): AudioSpeechletResponse => {
  return {
    outputSpeech: { type: "PlainText", text: output },
    card: { type: "Simple", title, content: output },
    directives: [
      {
        type: "AudioPlayer.Play",
        playBehavior: "REPLACE_ALL",
        audioItem: {
          stream: {
            token,
            url,
            offsetInMilliseconds,
          },
        },
      },
    ],
    shouldEndSession,
  };
};

type CardlessAudioSpeechletResponse = CardlessSpeechletResponse & AudioResponse;

export const buildCardlessAudioSpeechletResponse = (
  output: string,
  shouldEndSession: boolean,
  url: string,
  token: string,
  offsetInMilliseconds = 0
): CardlessAudioSpeechletResponse => {
  return {
    outputSpeech: { type: "PlainText", text: output },
    directives: [
      {
        type: "AudioPlayer.Play",
        playBehavior: "REPLACE_ALL",
        audioItem: {
          stream: {
            token,
            url,
            offsetInMilliseconds,
          },
        },
      },
    ],
    shouldEndSession,
  };
};

interface AudioEnqueueResponse {
  directives: [
    {
      type: string;
      playBehavior: string;
      audioItem: {
        stream: {
          url: string;
          token: string;
          expectedPreviousToken?: string;
          offsetInMilliseconds: number;
        };
      };
    }
  ];
  shouldEndSession: boolean;
}

export const buildAudioEnqueueResponse = (
  shouldEndSession: boolean,
  url: string,
  previousToken: string,
  nextToken: string,
  playBehavior = "ENQUEUE"
): AudioEnqueueResponse => {
  const toReturn: AudioEnqueueResponse = {
    directives: [
      {
        type: "AudioPlayer.Play",
        playBehavior,
        audioItem: {
          stream: {
            token: nextToken,
            url,
            offsetInMilliseconds: 0,
          },
        },
      },
    ],
    shouldEndSession,
  };

  if (playBehavior === "ENQUEUE") {
    toReturn.directives[0].audioItem.stream.expectedPreviousToken =
      previousToken;
  }

  return toReturn;
};

export const buildCancelSpeechletResponse = (
  title: string,
  output: string,
  shouldEndSession: boolean
) => {
  return {
    outputSpeech: { type: "PlainText", text: output },
    card: { type: "Simple", title, content: output },
    directives: [
      { type: "AudioPlayer.ClearQueue", clearBehavior: "CLEAR_ALL" },
    ],
    shouldEndSession,
  };
};

export const buildStopSpeechletResponse = (
  output: string,
  shouldEndSession: boolean
) => {
  return {
    outputSpeech: { type: "PlainText", text: output },
    directives: [{ type: "AudioPlayer.Stop", playBehavior: "REPLACE_ALL" }],
    shouldEndSession,
  };
};

export const buildShortSpeechletResponse = (
  output: string,
  shouldEndSession: boolean
): CardlessSpeechletResponse => {
  return {
    outputSpeech: { type: "PlainText", text: output },
    shouldEndSession,
  };
};

export interface Response {
  version: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionAttributes?: { [key: string]: any };
  response:
    | CardlessSpeechletResponse
    | VideoResponse
    | AudioSpeechletResponse
    | AudioEnqueueResponse;
}

export const buildResponse = (
  speechletResponse:
    | CardlessSpeechletResponse
    | VideoResponse
    | AudioSpeechletResponse
    | AudioEnqueueResponse,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionAttributes?: { [key: string]: any }
): Response => {
  return {
    version: "1.0",
    sessionAttributes,
    response: speechletResponse,
  };
};

interface VideoResponse {
  outputSpeech: OutputSpeech;
  directives: [
    {
      type: string;
      videoItem: {
        source: string;
        metadata?: {
          title?: string;
          subtitle?: string;
        };
      };
    }
  ];
}

export const buildVideoResponse = (
  title: string,
  output: string,
  url: string
): VideoResponse => {
  return {
    outputSpeech: { type: "PlainText", text: output },
    directives: [
      {
        type: "VideoApp.Launch",
        videoItem: { source: url, metadata: { title } },
      },
    ],
  };
};

export const buildAudioOrVideoResponse = (
  title: string,
  output: string,
  shouldEndSession: boolean,
  url: string,
  token: string,
  offsetInMilliseconds = 0,
  supportsVideo = false
) => {
  if (supportsVideo) {
    return buildVideoResponse(title, output, url);
  }

  return buildAudioSpeechletResponse(
    title,
    output,
    shouldEndSession,
    url,
    token,
    offsetInMilliseconds
  );
};
