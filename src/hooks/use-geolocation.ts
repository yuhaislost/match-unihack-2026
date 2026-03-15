"use client";

import { useCallback, useEffect, useState } from "react";

type GeolocationState = {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
};

const DEFAULT_STATE: GeolocationState = {
  latitude: null,
  longitude: null,
  error: null,
  loading: true,
};

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>(DEFAULT_STATE);

  const update = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        latitude: null,
        longitude: null,
        error: "Geolocation is not supported",
        loading: false,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
          loading: false,
        });
      },
      (err) => {
        setState({
          latitude: null,
          longitude: null,
          error: err.message,
          loading: false,
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    update();
  }, [update]);

  return { ...state, refresh: update };
}
