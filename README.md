Ì∫Ä Telegram Disappearing Photo ‚Äì Browser Extension Challenge

This project implements a browser extension capable of sending disappearing photos on Telegram Web, even though the feature is not officially supported in the web client.
The purpose of this challenge is to demonstrate ingenuity, rapid learning ability, and a deep understanding of modern web applications.

This solution focuses on:

exploratory learning

lightweight reverse engineering

incremental heuristics

resilient fallbacks

clean technical documentation

Ì≥å Goal

Enable the sending of self-destructing photos from Telegram Web, approximating the behavior available in the mobile app.

Since Telegram Web does not expose official APIs for this feature, the solution relies on observing, instrumenting, and interacting with:

internal Webpack modules

Telegram‚Äôs private APIs

internal request connectors (connector.request)

dynamic UI behavior in React

DOM fallbacks when internal APIs are unavailable

Ì∑† High-Level Architecture

The implementation consists of two main layers:

1. content.js ‚Äî persistence + page-context injection

injects inject.js into the Telegram Web environment

ensures long-running injection even when Telegram replaces <html> or <head> (common in SPAs)

uses a MutationObserver to re-inject if Telegram re-mounts the DOM

2. inject.js ‚Äî core logic

Responsible for:

intercepting Webpack runtime chunks

discovering internal modules dynamically

locating internal request connectors via multiple heuristics

exposing a clean public API via:
window.__tgInject

implementing the primary function:
sendDisappearingPhoto(peerId, file, ttlSeconds)

performing automatic fallback to a DOM-based upload flow when needed
(file input injection, simulated click events, heuristics for UI buttons)

Ì∑© Technical Strategy
1. Dynamic Webpack Inspection

Telegram Web uses an internal Webpack runtime similar to:

window.webpackChunktelegram_web_xxx


The extension:

dynamically finds any global chunk matching webpackChunk*

hooks into:

._push() (Webpack 4-style)

chunk.c (Webpack 5 runtime)

inspects all lazy-loaded modules

extracts their exports safely inside try/catch blocks

This guarantees compatibility even if:

Telegram changes the chunk name

classes are renamed/minified

modules load in different orders

the Web app version updates

2. Heuristic Extraction of the Internal Connector

Telegram internally uses calls like:

connector.request({ ... })


But:

the connector is not public

module names are minified

structure changes between builds

sometimes wrapped in factory functions

The solution attempts multiple strategies:

detect modules whose default export has .request

scan objects for functions named "request"

inspect signature shapes (params, method, flags, etc.)

match nested keys like "send", "invoke", "api", "call"

validate candidates with safe ‚Äúprobe requests‚Äù

These heuristics make the system robust across releases.

3. Upload Pipeline with Intelligent Fallback

Order of operations:

1. Native Internal Request (best case)

If the connector is successfully located, Telegram‚Äôs own internal uploadFile and sendMedia requests are used ‚Äî closest to the mobile behavior.

2. Secondary Heuristic Connector

If the primary connector is not found, the system attempts a wider search across all modules.

3. DOM Fallback Flow (‚ÄúGuaranteed Delivery Mode‚Äù)

When APIs are unavailable:

create an invisible <input type="file">

inject the file via DataTransfer

trigger upload logic used by real Telegram UI

attempt to configure TTL if the UI exposes it

automatically click the ‚Äúsend‚Äù button using selector heuristics

The philosophy:
It doesn't matter how ‚Äî as long as the photo is delivered.

Ìª†Ô∏è Public API (for debugging and automation)

The injected script exposes:

window.__tgInject.sendDisappearingPhoto(peerId, file, ttlSeconds)
window.__tgInject.pickAndSendPhoto(peerId, ttlSeconds)
window.__tgInject.ready                 // resolves when injection is stable
window.__tgInject.modules               // all discovered Webpack modules
window.__tgInject.searchInModules(pattern) // helpful for development

Ì∑™ Development Process
1. Exploration Phase

map Webpack modules

analyze app runtime

inspect lazy chunks

detect how file uploads are implemented

2. Webpack Scanner

built a generic, version-agnostic module inspector

3. Iterative Testing

probe internal request candidates

implement safe fallbacks

test multiple chat types

ensure resilience to re-mounting UI

4. Documentation

explanation of heuristics

design decisions

limitations and future possibilities

Ìø¶ Current Limitations

Telegram Web does not officially support disappearing media

true TTL behavior is only guaranteed on mobile clients

UI selectors may change across releases

DOM fallback cannot enforce TTL if the UI does not expose it

Ì≥ö Key Learnings

This challenge demonstrated:

ability to understand large SPAs without documentation

safe, ethical reverse engineering

dynamic module analysis in minified codebases

resilient system design

rapid learning and adaptability

creative problem solving under constraints

The project highlights practical experience with:

Webpack internals

browser extension architecture

DOM instrumentation

async pipelines

fault-tolerant design

‚úîÔ∏è Conclusion

Telegram Web does not officially support self-destructing photos.
Still, through:

dynamic module discovery

heuristic connector extraction

fallback-driven design

careful instrumentation

‚Ä¶it is possible to implement a consistent flow to send photos with TTL within the Web client‚Äôs limitations.

This project demonstrates ingenuity, rapid learning, and the ability to work with undocumented, evolving systems ‚Äî which is the core objective of the challenge.
