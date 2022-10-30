export interface Card {
  type: string;
  title?: string;
  content?: string;
  text?: string;
  image?: {
    smallImageUrl?: string;
    largeImageUrl?: string;
  };
}

// Quick interface for our Event object. This is event object that Alexa sends to our skill.
// Will only be including the fields that we need for this skill.

export interface AlexaEvent {
  version: string;
  /// Additional context associated with the request. Is not included in AudioPlayer, VideoApp, or PlaybackController requests.
  session?: {
    /// The session attributes. Bascially a key-value store for the session, for use in whatever data you want to store.
    attributes: Record<string, unknown>;
  };
  /// Provides your skill with information about the current state of the Alexa service and device at the time the request is sent to your service. Is included in all requests.
  context: {
    /// Information about the currently playing audio, if any. This is not included when the request is not customer initiated. For example, if the user presses the pause button on the remote control, the request is not customer initiated. In customer initiated requests, fields such as token and offsetInMilliseconds are included in the request object.
    AudioPlayer?: {
      /// The token that identifies the current stream.
      token: string;
      /// The offset in milliseconds from the start of the stream when the stream was paused.
      offsetInMilliseconds: number;
    };
    /// Provides information about the device on which the skill is running.
    System: {
      /// A token that can be used to access Alexa-specific APIs.
      apiAccessToken: string;
      /// A string which references the correct base URI to refer to by region, for use with the Alexa APIs.
      apiEndpoint: string;

      device: {
        supportedInterfaces: {
          /// If this is included, the device supports the AudioPlayer interface.
          AudioPlayer?: Record<string, never>;
          /// If this is included, the device supports the Display interface.
          VideoApp?: Record<string, never>;
        };
      };
    };
  };
  request: {
    /// The locale of the request, e.g. "en-US".
    locale: string;
    /// The intent that was invoked.
    intent: {
      /// The name of the intent.
      name: string;
      /// The slots that were provided with the intent. Slots are basically parameters that the user provides. Can be empty.
      slots: Record<
        string,
        | {
            /// The name of the slot.
            name: string;
            /// The value of the slot.
            value: string;
          }
        | undefined
      >;
    };
    /// The type of the request. In our case would be "IntentRequest", "LaunchRequest", or "SessionEndedRequest".
    type: string;
    /// The timestamp of the request.
    timestamp: string;
    /// Included in the AudioPlayer.PlaybackFailed request. Indicates the reason for the failure.
    error?: {
      type: string;
      message: string;
    };
    /// Included in the AudioPlayer.PlaybackStarted, AudioPlayer.PlaybackFinished, and AudioPlayer.PlaybackStopped requests. Is an opaque token that represents the current stream.
    token?: string;
    /// Included in the AudioPlayer.PlaybackStarted, AudioPlayer.PlaybackFinished, and AudioPlayer.PlaybackStopped requests. The offset in milliseconds from the start of the stream when the event occurred.
    offsetInMilliseconds?: number;
  };

  // Notes:
  // - The token field is provided by us in the Play directive. It is used to identify the current stream. We can serialize not only the URL, but also the metadata we want to associate with the stream in the form of query parameters.
}

export interface OutputSpeech {
  type: string;
  text?: string;
  ssml?: string;
  playBehavior?: string;
}
