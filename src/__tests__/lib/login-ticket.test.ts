import { describe, it, expect } from "vitest";
import {
  LOGIN_DEEP_LINK_BASE,
  buildLoginDeepLink,
  extractLoginTicket,
  isValidTicketFormat,
} from "@/lib/login-ticket";

const TICKET = "a".repeat(64);

describe("il contratto del deep link", () => {
  it("round-trip: quello che il server costruisce, il client lo rilegge", () => {
    expect(extractLoginTicket(buildLoginDeepLink(TICKET))).toBe(TICKET);
  });

  it("usa lo schema registrato nell'intent-filter di MainActivity", () => {
    expect(buildLoginDeepLink(TICKET).startsWith("goaltracker://login?")).toBe(true);
  });
});

describe("extractLoginTicket", () => {
  it("ignora gli URL che non sono il nostro deep link", () => {
    expect(extractLoginTicket("https://goal-tracker-five-wheat.vercel.app/login?ticket=" + TICKET)).toBeNull();
    expect(extractLoginTicket("goaltracker://altro?ticket=" + TICKET)).toBeNull();
    expect(extractLoginTicket(undefined)).toBeNull();
    expect(extractLoginTicket("")).toBeNull();
  });

  it("rifiuta ticket dal formato sbagliato invece di passarli al server", () => {
    expect(extractLoginTicket(LOGIN_DEEP_LINK_BASE + "?ticket=abc")).toBeNull();
    expect(extractLoginTicket(LOGIN_DEEP_LINK_BASE + "?ticket=" + "Z".repeat(64))).toBeNull();
    expect(extractLoginTicket(LOGIN_DEEP_LINK_BASE + "?ticket=" + "a".repeat(65))).toBeNull();
  });

  it("trova il ticket anche in mezzo ad altri parametri", () => {
    expect(extractLoginTicket(LOGIN_DEEP_LINK_BASE + "?x=1&ticket=" + TICKET + "&y=2")).toBe(TICKET);
  });
});

describe("isValidTicketFormat", () => {
  it("accetta solo 64 esadecimali minuscoli", () => {
    expect(isValidTicketFormat(TICKET)).toBe(true);
    expect(isValidTicketFormat("A".repeat(64))).toBe(false);
    expect(isValidTicketFormat("a".repeat(63))).toBe(false);
    expect(isValidTicketFormat("")).toBe(false);
  });
});
