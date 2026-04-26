import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

vi.mock("@/contexts/AuthContext", async () => {
  return {
    useAuth: vi.fn(),
  };
});

import { useAuth } from "@/contexts/AuthContext";

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={["/app"]}>
      <Routes>
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <div>conteudo-privado</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>tela-login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("[REG] ProtectedRoute", () => {
  it("redireciona para /login quando não autenticado", () => {
    (useAuth as any).mockReturnValue({ user: null, loading: false });
    renderRoute();
    expect(screen.getByText("tela-login")).toBeInTheDocument();
  });

  it("mostra spinner enquanto loading=true", () => {
    (useAuth as any).mockReturnValue({ user: null, loading: true });
    const { container } = renderRoute();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renderiza conteúdo quando autenticado", () => {
    (useAuth as any).mockReturnValue({
      user: { id: "u1", email: "x@y.com" },
      loading: false,
    });
    renderRoute();
    expect(screen.getByText("conteudo-privado")).toBeInTheDocument();
  });
});