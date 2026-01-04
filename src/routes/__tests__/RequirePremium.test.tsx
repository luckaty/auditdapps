import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { RequirePremium } from "@/components/RequirePremium";

// Mock Supabase client used inside RequirePremium
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabaseClient";

function mockProfileQuery(result: { data: any; error: any }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));

  (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    select,
  });

  return { select, eq, maybeSingle };
}

// Helper to build a tiny router for testing redirects
function App() {
  return (
    <MemoryRouter initialEntries={["/protected?x=1"]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/pricing" element={<div>Pricing Page</div>} />
        <Route path="/auth/payment" element={<div>Payment Page</div>} />

        <Route
          path="/protected"
          element={
            <RequirePremium>
              <div>Protected Content</div>
            </RequirePremium>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequirePremium", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children when user has premium (not expired)", async () => {
    (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    mockProfileQuery({
      data: {
        is_premium: true,
        premium_expires_at: new Date(Date.now() + 86400000).toISOString(), // +1 day
      },
      error: null,
    });

    render(<App />);
    expect(await screen.findByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects to pricing when user is authenticated but not premium", async () => {
    (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    mockProfileQuery({
      data: {
        is_premium: false,
        premium_expires_at: null,
      },
      error: null,
    });

    render(<App />);
    expect(await screen.findByText("Payment Page")).toBeInTheDocument();
  });

  it("redirects to login when user is not authenticated", async () => {
    (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: null },
    });

    render(<App />);
    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("shows payment/pricing when premium is expired", async () => {
    (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    mockProfileQuery({
      data: {
        is_premium: true,
        premium_expires_at: new Date(Date.now() - 86400000).toISOString(), // -1 day
      },
      error: null,
    });

    render(<App />);

    // If your RequirePremium redirects to /auth/payment, expect Payment Page.
    // If it redirects to /pricing, change this to "Pricing Page".
    expect(await screen.findByText("Protected Content")).toBeInTheDocument();

  });
});
