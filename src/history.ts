// import { logger } from "./logger";
// import { getStrings } from "./strings";
// import { shuffle } from "./util";
// import { getTracksFromUrl } from "./youtube";

// import type { AlexaEvent } from "./types";

// type AuthHeaders = HeadersInit & {
//   Authorization: string;
//   "Content-Type": string;
// };

// const getHeaders = (event: AlexaEvent) => {
//   const { apiAccessToken } = event.context.System;
//   const headers: AuthHeaders = {
//     Authorization: `Bearer ${apiAccessToken}`,
//     "Content-Type": "application/json",
//   };

//   return headers;
// };

// export const createList = async (
//   event: AlexaEvent,
//   listTitle: string,
//   listItems: string[] = []
// ) => {
//   const headers = getHeaders(event);
//   const data = { name: listTitle, state: "active" };
//   const url = `${event.context.System.apiEndpoint}/v2/householdlists/`;

//   const req = await fetch(url, {
//     method: "POST",
//     headers,
//     body: JSON.stringify(data),
//   });

//   switch (req.status) {
//   case 201: {
//     const data = await req.json();
//     const { listId } = data;

//     listItems.reverse();

//     for (const listItem of listItems) {
//       postListItem(event, listId, headers, listItem);
//     }

//     return true;
//   }
//   case 403:
//     logger.info("Forbidden");
//     return false;
//   case 409:
//     logger.info("List already exists");
//     return true;
//   }

//   return true;
// };

// export const getListId = async (event: AlexaEvent, listTitle: string) => {
//   const headers = getHeaders(event);
//   const url = `${event.context.System.apiEndpoint}/v2/householdlists/`;

//   const res = await fetch(url, { headers });
//   const data = await res.json();

//   if (!data?.lists) {
//     return "";
//   }

//   for (const list of data.lists) {
//     if (list.name === listTitle && list.state === "active") {
//       return list.listId as string;
//     }
//   }

//   return "";
// };

// //TODO: Feature: History
// const readListItem = async (event: AlexaEvent, listId: string) => {
//   const items = await getList(event, listId);
//   if (items && items.length) {
//     return [items[0].id, items[0].value, items[0].version];
//   }
//   return [null, null, null];
// };

// //TODO: Feature: History
// const updateListItem = async (
//   event: AlexaEvent,
//   listId: string,
//   itemId: string,
//   itemValue: string,
//   itemVersion: string,
//   itemStatus = "completed"
// ) => {
//   const headers = getHeaders(event);
//   const data = JSON.stringify({
//     value: itemValue,
//     status: itemStatus,
//     version: itemVersion,
//   });
//   const url = `${event.context.System.apiEndpoint}/v2/householdlists/${listId}/items/${itemId}`;

//   await fetch(url, {
//     method: "PUT",
//     headers,
//     body: data,
//   });
// };

// /**
//  * Creates a list item which is stored in the Alexa app. This function is used in scenarios in which we would like to persist a value for the user, such as a favorite song. The metadata for the item stored would be formatted as follows: {songName}|{songUrl}
//  *
//  * @param {AlexaEvent} event The Alexa event object
//  * @param {string} listId The list ID
//  * @param {string} description The description of the list item
//  */
// const createListItem = (
//   event: AlexaEvent,
//   listId: string,
//   description: string
// ) => {
//   const headers = getHeaders(event);
//   postListItem(event, listId, headers, description);
// };

// const postListItem = async (
//   event: AlexaEvent,
//   listId: string,
//   headers: AuthHeaders,
//   description: string
// ) => {
//   const data = { value: description, status: "active" };
//   const url = `${event.context.System.apiEndpoint}/v2/householdlists/${listId}/items/`;

//   await fetch(url, {
//     method: "POST",
//     headers,
//     body: JSON.stringify(data),
//   });
// };

// interface ListItem {
//   id: string;
//   version: string;
//   value: string;
//   status: string;
//   createdTime: string;
//   updatedTime: string;
//   href: string;
// }

// export const getList = async (event: AlexaEvent, listId: string) => {
//   const headers = getHeaders(event);
//   const url = `${event.context.System.apiEndpoint}/v2/householdlists/${listId}/active/`;
//   const req = await fetch(url, { headers });
//   const data = await req.json();

//   if (req.status === 200) {
//     // We know there is a links field that can potentially include a next field which points to the rest of the list. We don't need to worry about that here, since we will not be storing more than 100 entries in the list.
//     return data.items as ListItem[];
//   }

//   return null;
// };

// const trimList = async (event: AlexaEvent, listId: string) => {
//   const items = await getList(event, listId);

//   if (!items) {
//     return;
//   }

//   const maxLength = 90;

//   for (const item of items.slice(maxLength)) {
//     const { id } = item;
//     deleteListItem(event, listId, id);
//   }
// };

// const deleteListItem = async (
//   event: AlexaEvent,
//   listId: string,
//   itemId: string
// ) => {
//   const headers = getHeaders(event);
//   const url = `${event.context.System.apiEndpoint}/v2/householdlists/${listId}/items/${itemId}`;

//   await fetch(url, {
//     method: "DELETE",
//     headers,
//   });
// };

// //TODO: Feature: History
// export const addToList = async (event: AlexaEvent, title: string) => {
//   const listId = await getListId(event, "YouTube");

//   if (!listId) {
//     return;
//   }

//   createListItem(event, listId, title);
//   trimList(event, listId);
// };

// //TODO: Feature: History

// /**
//  * Looks for a favorite playlist in the user's "Youtube Favorites" list. This will then return a tuple containing the videos in the playlist, a speech string, and the name of the playlist. Because the links stored in the favorites list can point to playlists or videos, our speech output string will communicate the type that was found when announcing it on the Alexa.
//  *
//  * @param {AlexaEvent} event The Alexa event object
//  * @param {string} query The query to search for
//  * @param {boolean} [doShuffle=false] Whether or not to shuffle the playlist
//  * @return {(Promise<[any[], string, string | null]>)} A tuple containing the videos in the playlist, a speech string, and the name of the playlist
//  */
// const checkFavoriteVideos = async (
//   event: AlexaEvent,
//   query: string,
//   doShuffle = false
// ): Promise<[string[], string, string]> => {
//   const listId = await getListId(event, "YouTube Favorites");

//   if (!listId) {
//     return [[], "", ""];
//   }

//   const playlists = await getList(event, listId);

//   if (!playlists) {
//     return [[], getStrings().noplaylistresults, ""];
//   }

//   for (const playlist of playlists) {
//     const { value } = playlist;
//     const [playlistName, playlistUrl] = value.split("|");

//     if (query.toLowerCase() === playlistName.toLowerCase().trim()) {
//       const [videos, speechOutput, playlistTitle] = await getTracksFromUrl(
//         playlistUrl.trim()
//       );

//       if (doShuffle) {
//         shuffle(videos);
//       }

//       return [videos.slice(0, 50), speechOutput, playlistTitle];
//     }
//   }
//   return [[], getStrings().video, ""];
// };

// export { checkFavoriteVideos };
