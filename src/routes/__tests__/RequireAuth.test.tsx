import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { RequireAuth } from "@/components/RequireAuth";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import { supabase } from "@/lib/supabaseClient";

function App() {
  return (
    <MemoryRouter initialEntries={["/protected?ref=1"]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>Protected Content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children when authenticated", async () => {
    (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("redirects to login when not authenticated", async () => {
    (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: null },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });
});
