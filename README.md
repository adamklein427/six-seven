# Six Seven

A daily brief I made for myself. Each morning it gathers market data, news, weather, energy, housing and calendar information, has a language model write the interpretation, and publishes one edition: a globe that carries the day, with Today, Map and Analysis views.

**Live sample: https://adamklein427.github.io/six-seven/**

This is one frozen edition, Wednesday, November 4, 2026 (run 137). It's static: built offline from stored data, with no server, no accounts and no keys. It was written before that day's Fed decision, so its calls are still open. Not investment advice.

## What makes it trustworthy

- **The model never produces a number.** Every figure comes from a data feed and a stored record. The model only interprets.
- **Its claims cite evidence.** What the model writes has to cite evidence by ID, and the code rejects unknown or missing IDs.
- **Each source fails on its own.** One dead feed doesn't stop the edition.
- **It keeps score.** Calls are graded automatically and the record is published whether or not it flatters the brief. In this edition that's 34 of 68 graded calls right, which is a coin flip, with 15 still open.

## What's in this repo

Only the built page and its data: HTML, JavaScript, one edition's JSON and the globe's textures. The Python pipeline and the private version I use each morning aren't here. This edition comes from an allow-list: a field ships only if it's listed, and the build fails if a private term turns up.

## How it was made

I directed AI coding agents (Claude Code and Hermes) to build it in Python, SQLite and Three.js. I haven't measured accuracy, time saved or returns, and I don't claim any.
