import { describe, it, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { RequirePremium } from "../RequirePremium";

function App({ plan }: { plan: "free" | "one-time" | "premium" }) {
  return (
    <MemoryRouter initialEntries={["/protected?x=1"]}>
      <Routes>
        <Route path="/pricing" element={<div>Pricing Page</div>} />
        <Route
          path="/protected"
          element={
            <RequirePremium plan={plan}>
              <div>Protected Content</div>
            </RequirePremium>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequirePremium", () => {
  it("renders children for premium", () => {
    render(<App plan="premium" />);
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("renders children for one-time", () => {
    render(<App plan="one-time" />);
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects free users to pricing", () => {
    render(<App plan="free" />);
    expect(screen.getByText("Pricing Page")).toBeInTheDocument();
  });
});
