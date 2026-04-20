import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlacePickerMap from "~/components/PlacePickerMap";

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
}));

const mockPlaces = [
  {
    place_id: "place_1",
    name: "テストカフェ",
    vicinity: "渋谷区1-1",
    lat: 35.6762,
    lng: 139.6503,
    rating: 4.2,
    types: ["cafe"],
  },
  {
    place_id: "place_2",
    name: "テストレストラン",
    vicinity: "渋谷区2-2",
    lat: 35.677,
    lng: 139.651,
    rating: 3.8,
    types: ["restaurant"],
  },
];

vi.mock("~/api/places", () => ({
  getNearbyVisitablePlaces: vi.fn(),
  snoozePlace: vi.fn(),
  getPlacePhoto: vi.fn(),
}));

import { getNearbyVisitablePlaces } from "~/api/places";

describe("PlacePickerMap", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNearbyVisitablePlaces).mockResolvedValue(mockPlaces);
  });

  test("マップとAPIProviderが描画される", async () => {
    render(
      <PlacePickerMap
        authToken="token"
        userLat={35.6762}
        userLng={139.6503}
        onSelect={onSelect}
      />,
    );

    expect(await screen.findByTestId("api-provider")).toBeInTheDocument();
    expect(screen.getByTestId("google-map")).toBeInTheDocument();
  });

  test("施設数分のピンが表示される", async () => {
    render(
      <PlacePickerMap
        authToken="token"
        userLat={35.6762}
        userLng={139.6503}
        onSelect={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("map-marker")).toHaveLength(
        mockPlaces.length,
      );
    });
  });

  test("ピンをクリックするとInfoWindowが表示される", async () => {
    render(
      <PlacePickerMap
        authToken="token"
        userLat={35.6762}
        userLng={139.6503}
        onSelect={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("map-marker")).toHaveLength(
        mockPlaces.length,
      );
    });

    expect(screen.queryByTestId("info-window")).toBeNull();
    fireEvent.click(screen.getAllByTestId("map-marker")[0]);
    expect(screen.getByTestId("info-window")).toBeInTheDocument();
  });

  test("InfoWindowに施設名が表示される", async () => {
    render(
      <PlacePickerMap
        authToken="token"
        userLat={35.6762}
        userLng={139.6503}
        onSelect={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("map-marker")).toHaveLength(
        mockPlaces.length,
      );
    });

    fireEvent.click(screen.getAllByTestId("map-marker")[0]);
    expect(screen.getByText("テストカフェ")).toBeInTheDocument();
  });

  test("「ここに行く！」ボタンを押すと onSelect が呼ばれる", async () => {
    render(
      <PlacePickerMap
        authToken="token"
        userLat={35.6762}
        userLng={139.6503}
        onSelect={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("map-marker")).toHaveLength(
        mockPlaces.length,
      );
    });

    fireEvent.click(screen.getAllByTestId("map-marker")[0]);
    fireEvent.click(screen.getByRole("button", { name: "ここに行く！" }));

    expect(onSelect).toHaveBeenCalledWith(mockPlaces[0]);
  });
});
