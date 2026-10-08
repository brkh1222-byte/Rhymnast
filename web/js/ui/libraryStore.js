// The pose library the app uses = the default examples shipped with the app
// (library/defaultLibrary.js) + the examples your team taught on this computer.
// Taught examples stay in this browser (localStorage). Export/Import moves them between
// computers so the whole team can share one library. Nothing is uploaded.

import { PoseLibrary, LIBRARY_VERSION } from '../library/recognizer.js';
import { FEATURES } from '../library/signature.js';
import defaultLibraryData from '../library/defaultLibrary.js';

const STORAGE_KEY = 'rhymnast.taughtPoses.v1';
const defaultExamples = PoseLibrary.fromJSON(defaultLibraryData).examples;
let taught = load();

function load() {
  try {
    const data = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null');
    return data ? PoseLibrary.fromJSON(data).examples : [];
  } catch {
    return []; // storage blocked or corrupted: start without taught examples
  }
}

function save() {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(new PoseLibrary(taught).toJSON()));
    return true;
  } catch {
    return false; // storage full or blocked: examples still work until the page is closed
  }
}

/** The full library (default + taught), as a new PoseLibrary. */
export function currentLibrary() {
  return new PoseLibrary([...defaultExamples, ...taught]);
}

/** Adds taught examples of one pose. Returns false if they could not be saved in the browser. */
export function teach(label, signatures, source = 'taught') {
  const lib = new PoseLibrary(taught);
  for (const f of signatures) lib.add(label, f, source);
  taught = lib.examples;
  return save();
}

/** Number of examples per pose: { default: {...}, taught: {...} }. */
export function libraryCounts() {
  return { default: new PoseLibrary(defaultExamples).counts(), taught: new PoseLibrary(taught).counts() };
}

/** Taught examples as a JSON string, to share with the team. */
export function exportTaught() {
  return JSON.stringify(new PoseLibrary(taught).toJSON());
}

/** Adds the examples from an exported file. Returns how many were added. */
export function importTaught(text) {
  const data = JSON.parse(text);
  if (data.version !== LIBRARY_VERSION || data.features?.join() !== FEATURES.map((f) => f.name).join()) {
    throw new Error('This file was made by a different version of the app');
  }
  const incoming = PoseLibrary.fromJSON(data).examples;
  taught = [...taught, ...incoming];
  save();
  return incoming.length;
}

/** Removes every taught example (the default library stays). */
export function resetTaught() {
  taught = [];
  save();
}
