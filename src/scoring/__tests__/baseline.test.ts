import { describe, it, expect } from "vitest";
import { buildBaselineFindings, summarizeBaseline } from "../baseline";

describe("baseline scoring engine", () => {
  it("does not create a finding when a control is answered Yes", () => {
    const responses = {
      "Do you have an incident response plan?": ["Yes"],
    };

    const { findings } = buildBaselineFindings(responses, "organization");
    expect(findings).toHaveLength(0);
  });

  it("creates a critical finding when a critical control is answered No", () => {
    const responses = {
      "Do you have an incident response plan?": ["No"],
    };

    const { findings } = buildBaselineFindings(responses, "organization");

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].mitigation).toBe("none");
    expect(findings[0].text.toLowerCase()).toContain("control missing");
  });

  it("flags contradictory answers and marks mitigation as partial", () => {
    const responses = {
      "Do you have an incident response plan?": ["Yes", "No"],
    };

    const { findings } = buildBaselineFindings(responses, "organization");

    expect(findings).toHaveLength(1);
    expect(findings[0].mitigation).toBe("partial");
    expect(findings[0].text).toContain("conflicting answers detected");
  });

  it("excludes pure N/A answers from scoring", () => {
    const responses = {
      "Do you have an incident response plan?": ["Not applicable (N/A)"],
    };

    const { findings } = buildBaselineFindings(responses, "organization");
    expect(findings).toHaveLength(0);
  });

  it("adds a global critical red flag when most controls are missing", () => {
    const responses = {
      "Do you have an incident response plan?": ["No"],
      "Are administrative keys rotated?": ["No"],
      "Do you enforce least privilege access control?": ["No"],
      "Do you have emergency pause circuit breaker?": ["No"],
      "Do you use secure protocols like TLS/HTTPS?": ["No"],
    };

    const { findings } = buildBaselineFindings(responses, "organization");

    expect(
      findings.some((f) =>
        f.text.includes("Widespread absence of baseline controls")
      )
    ).toBe(true);
  });

  it("summarizeBaseline returns totals and a numeric score", () => {
    const responses = {
      "Do you have an incident response plan?": ["No"],
    };

    const summary = summarizeBaseline(responses, "organization");

    expect(summary.findings).toHaveLength(1);
    expect(typeof summary.score).toBe("number");
    expect(summary.totals).toBeDefined();
  });
});
