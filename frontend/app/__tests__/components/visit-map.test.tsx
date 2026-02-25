import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import VisitMap from "~/components/visit-map";
import type { MapVisit } from "~/types/visit";

// @vis.gl/react-google-maps を jsdom 環境向けにモック
vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="api-provider">{children}</div>
  ),
  Map: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="google-map">{children}</div>
  ),
  AdvancedMarker: ({
    onClick,
    children,
  }: {
    onClick?: () => void;
    children?: React.ReactNode;
  }) => (
    <div data-testid="map-marker" onClick={onClick}>
      {children}
    </div>
  ),
  InfoWindow: ({
    onClose,
    children,
  }: {
    onClose?: () => void;
    children?: React.ReactNode;
  }) => (
    <div data-testid="info-window">
      {children}
      <button onClick={onClose} aria-label="閉じる">
        ×
      </button>
    </div>
  ),
  useMap: () => null,
}));

const mockVisits: MapVisit[] = [
  {
    id: 1,
    place_id: "ChIJabc",
    place_name: "カフェA",
    lat: 35.6762,
    lng: 139.6503,
    category: "cafe",
    is_comfort_zone: false,
    visited_at: "2024-02-10T12:00:00Z",
  },
  {
    id: 2,
    place_id: "ChIJdef",
    place_name: "公園B",
    lat: 35.68,
    lng: 139.66,
    category: "park",
    is_comfort_zone: true,
    visited_at: "2024-02-11T10:00:00Z",
  },
];

describe("VisitMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("APIProviderとMapコンポーネントが描画される", () => {
    render(
      <MemoryRouter>
        <VisitMap visits={[]} />
      </MemoryRouter>
    );
    expect(screen.getByTestId("api-provider")).toBeInTheDocument();
    expect(screen.getByTestId("google-map")).toBeInTheDocument();
  });

  test("訪問データ分のピンが表示される", () => {
    render(
      <MemoryRouter>
        <VisitMap visits={mockVisits} />
      </MemoryRouter>
    );
    const markers = screen.getAllByTestId("map-marker");
    expect(markers).toHaveLength(mockVisits.length);
  });

  test("訪問データが空のとき、ピンが表示されない", () => {
    render(
      <MemoryRouter>
        <VisitMap visits={[]} />
      </MemoryRouter>
    );
    expect(screen.queryByTestId("map-marker")).toBeNull();
  });

  test("ピンクリックでInfoWindowが表示される", () => {
    render(
      <MemoryRouter>
        <VisitMap visits={mockVisits} />
      </MemoryRouter>
    );
    // 最初はInfoWindowなし
    expect(screen.queryByTestId("info-window")).toBeNull();

    // 1枚目のピンをクリック
    fireEvent.click(screen.getAllByTestId("map-marker")[0]);

    expect(screen.getByTestId("info-window")).toBeInTheDocument();
  });

  test("InfoWindowに場所名と詳細リンクが表示される", () => {
    render(
      <MemoryRouter>
        <VisitMap visits={mockVisits} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getAllByTestId("map-marker")[0]);

    expect(screen.getByText("カフェA")).toBeInTheDocument();
    const detailLink = screen.getByRole("link", { name: /詳細を見る/ });
    expect(detailLink).toHaveAttribute("href", "/history/1");
  });

  test("InfoWindowの閉じるボタンで非表示になる", () => {
    render(
      <MemoryRouter>
        <VisitMap visits={mockVisits} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getAllByTestId("map-marker")[0]);
    expect(screen.getByTestId("info-window")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("閉じる"));
    expect(screen.queryByTestId("info-window")).toBeNull();
  });

  test("別のピンをクリックするとInfoWindowが切り替わる", () => {
    render(
      <MemoryRouter>
        <VisitMap visits={mockVisits} />
      </MemoryRouter>
    );
    // 1枚目
    fireEvent.click(screen.getAllByTestId("map-marker")[0]);
    expect(screen.getByText("カフェA")).toBeInTheDocument();

    // 2枚目
    fireEvent.click(screen.getAllByTestId("map-marker")[1]);
    expect(screen.getByText("公園B")).toBeInTheDocument();
    expect(screen.queryByText("カフェA")).toBeNull();
  });

  test("is_comfort_zone=true のピンにも詳細リンクが表示される", () => {
    render(
      <MemoryRouter>
        <VisitMap visits={mockVisits} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getAllByTestId("map-marker")[1]);
    const detailLink = screen.getByRole("link", { name: /詳細を見る/ });
    expect(detailLink).toHaveAttribute("href", "/history/2");
  });
});
