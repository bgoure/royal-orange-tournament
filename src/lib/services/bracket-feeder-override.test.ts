import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateFeederOverrideAck,
  formatFeederSeatLabel,
} from "./bracket-feeder-override";

const g12Winner = { gameNumber: "12", matchIndex: 3, kind: "WINNER" };
const g8Loser = { gameNumber: "8", matchIndex: 1, kind: "LOSER" };

describe("formatFeederSeatLabel", () => {
  it("names Winner/Loser from game number", () => {
    assert.equal(formatFeederSeatLabel("Away", g12Winner), "Away is G12 Winner");
    assert.equal(formatFeederSeatLabel("Home", g8Loser), "Home is G8 Loser");
  });

  it("falls back to match index and bye labels", () => {
    assert.equal(
      formatFeederSeatLabel("Away", { gameNumber: null, matchIndex: 4, kind: "WINNER" }),
      "Away is Match 5 Winner",
    );
    assert.equal(
      formatFeederSeatLabel("Home", { gameNumber: "R6 Bye", matchIndex: 0, kind: "WINNER" }),
      "Home is R6 Bye Winner",
    );
  });

  it("returns null when the seat is not a match feeder", () => {
    assert.equal(formatFeederSeatLabel("Away", null), null);
  });
});

describe("evaluateFeederOverrideAck", () => {
  it("skips sit-out rows even when a feeder is present", () => {
    assert.equal(
      evaluateFeederOverrideAck({
        isSitOut: true,
        currentHomeTeamId: null,
        currentAwayTeamId: null,
        nextHomeTeamId: "t1",
        nextAwayTeamId: null,
        homeFeeder: g12Winner,
        awayFeeder: null,
        gameLocked: true,
      }),
      null,
    );
  });

  it("skips when nothing changed", () => {
    assert.equal(
      evaluateFeederOverrideAck({
        isSitOut: false,
        currentHomeTeamId: "t1",
        currentAwayTeamId: "t2",
        nextHomeTeamId: "t1",
        nextAwayTeamId: "t2",
        homeFeeder: g12Winner,
        awayFeeder: g8Loser,
        gameLocked: true,
      }),
      null,
    );
  });

  it("skips changing the non-feeder (implicit seed) side of a half-fed match", () => {
    assert.equal(
      evaluateFeederOverrideAck({
        isSitOut: false,
        currentHomeTeamId: "seed",
        currentAwayTeamId: null,
        nextHomeTeamId: "other-seed",
        nextAwayTeamId: null,
        homeFeeder: null,
        awayFeeder: g12Winner,
        gameLocked: false,
      }),
      null,
    );
  });

  it("requires a named ack when a feeder side changes", () => {
    const ack = evaluateFeederOverrideAck({
      isSitOut: false,
      currentHomeTeamId: null,
      currentAwayTeamId: null,
      nextHomeTeamId: null,
      nextAwayTeamId: "t1",
      homeFeeder: null,
      awayFeeder: g12Winner,
      gameLocked: false,
    });
    assert.ok(ack);
    assert.match(ack!.message, /Away is G12 Winner/);
    assert.match(ack!.message, /replace that feeder result/);
    assert.match(ack!.message, /Check the box/);
  });

  it("names both feeders when both sides change", () => {
    const ack = evaluateFeederOverrideAck({
      isSitOut: false,
      currentHomeTeamId: null,
      currentAwayTeamId: null,
      nextHomeTeamId: "t2",
      nextAwayTeamId: "t1",
      homeFeeder: g8Loser,
      awayFeeder: g12Winner,
      gameLocked: false,
    });
    assert.ok(ack);
    assert.match(ack!.message, /Away is G12 Winner/);
    assert.match(ack!.message, /Home is G8 Loser/);
    assert.match(ack!.message, /those feeder results/);
  });

  it("requires ack for a live or scored game even without feeder changes", () => {
    const ack = evaluateFeederOverrideAck({
      isSitOut: false,
      currentHomeTeamId: "t1",
      currentAwayTeamId: "t2",
      nextHomeTeamId: "t3",
      nextAwayTeamId: "t2",
      homeFeeder: null,
      awayFeeder: null,
      gameLocked: true,
    });
    assert.ok(ack);
    assert.match(ack!.message, /live or already scored/);
    assert.doesNotMatch(ack!.message, /feeder result/);
  });

  it("combines feeder names and the live/scored clause", () => {
    const ack = evaluateFeederOverrideAck({
      isSitOut: false,
      currentHomeTeamId: null,
      currentAwayTeamId: "old",
      nextHomeTeamId: null,
      nextAwayTeamId: "new",
      homeFeeder: null,
      awayFeeder: g12Winner,
      gameLocked: true,
    });
    assert.ok(ack);
    assert.match(ack!.message, /Away is G12 Winner/);
    assert.match(ack!.message, /live or already scored/);
  });
});
