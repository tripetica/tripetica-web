"use client";

export type GpsMarkerIcon = {
  className: string;
  html: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
  popupAnchor?: [number, number];
};

type LatLng = { lat: () => number; lng: () => number };
type ListenerHandle = { remove: () => void };
type GoogleMap = {
  setCenter: (position: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  getCenter: () => LatLng | null | undefined;
  getZoom: () => number | null | undefined;
  fitBounds: (bounds: GoogleBounds, padding?: number) => void;
  panTo: (position: { lat: number; lng: number }) => void;
  addListener: (event: string, handler: () => void) => ListenerHandle;
  setOptions: (options: { maxZoom?: number }) => void;
};
type GoogleBounds = { extend: (position: LatLng) => void };
type GoogleInfo = {
  open: (options: { map: GoogleMap; shouldFocus?: boolean }) => void;
  close: () => void;
  setPosition: (position: { lat: number; lng: number }) => void;
  setContent: (content: HTMLElement) => void;
  addListener: (event: string, handler: () => void) => ListenerHandle;
};
type GoogleOverlay = {
  setMap: (map: GoogleMap | null) => void;
  getPanes: () => { overlayMouseTarget: HTMLElement; floatPane: HTMLElement } | null;
  getProjection: () => { fromLatLngToDivPixel: (position: LatLng) => { x: number; y: number } | null } | null;
  onAdd: () => void;
  draw: () => void;
  onRemove: () => void;
};
type GooglePolyline = { setMap: (map: GoogleMap | null) => void };
type GoogleNamespace = {
  maps: {
    Map: new (element: HTMLElement, options: object) => GoogleMap;
    LatLng: new (latitude: number, longitude: number) => LatLng;
    LatLngBounds: new () => GoogleBounds;
    Polyline: new (options: object) => GooglePolyline;
    InfoWindow: new (options: object) => GoogleInfo;
    OverlayView: new () => GoogleOverlay;
    Size: new (width: number, height: number) => object;
    event: {
      trigger: (target: object, name: string) => void;
    };
  };
};

type MapListener = () => void;
type MarkerListener = (event?: { originalEvent?: Event }) => void;

declare global {
  interface Window {
    google?: GoogleNamespace;
    gm_authFailure?: () => void;
    __tripeticaGoogleMapCreates?: number;
  }
}

const READY = "__tripeticaMapsReady";
let loading: Promise<GoogleNamespace> | null = null;
const authFailures = new Set<() => void>();

function mapsApi() {
  const maps = window.google?.maps;
  if (!maps?.Map || !maps.OverlayView || !maps.InfoWindow) {
    throw new Error("Google Maps did not load");
  }
  return maps;
}

export function loadGoogleMaps() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps loads in the browser"));
  }
  if (window.google?.maps?.Map && window.google.maps.OverlayView) {
    return Promise.resolve(window.google);
  }
  if (loading) return loading;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Promise.reject(new Error("Google Maps key is missing"));
  }
  loading = new Promise((resolve, reject) => {
    const ready = () => {
      if (window.google?.maps?.Map) resolve(window.google);
      else reject(new Error("Google Maps did not load"));
    };
    (window as unknown as Record<string, () => void>)[READY] = ready;
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => {
      previous?.();
      for (const listener of authFailures) listener();
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({ key, v: "weekly", callback: READY });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("Google Maps script failed"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type GpsMapMarker = {
  addTo: (target: GpsMapHandle | GpsMapLayer) => GpsMapMarker;
  setIcon: (icon: GpsMarkerIcon) => void;
  setLatLng: (next: [number, number]) => void;
  getLatLng: () => { lat: number; lng: number };
  setOpacity: (value: number) => void;
  setZIndexOffset: (offset: number) => void;
  bindPopup: (content: HTMLElement | string, options?: { autoPan?: false; keepInView?: false; autoPanOnFocus?: false }) => GpsMapMarker;
  isPopupOpen: () => boolean;
  openPopup: () => void;
  closePopup: () => void;
  on: (event: "click" | "popupopen" | "popupclose", handler: MarkerListener) => void;
  off: (event: "click") => void;
  getTooltip: () => object | null;
  unbindTooltip: () => void;
  bindTooltip: (html: string, options: { permanent: true; direction: string; offset?: [number, number]; opacity?: number; className: string; interactive: false }) => void;
  remove: () => void;
};

export type GpsMapLayer = {
  addTo: (map: GpsMapHandle) => void;
  remove: () => void;
};

export type GpsMapHandle = {
  on: (event: "dragstart" | "zoomstart", handler: MapListener) => void;
  setView: (latlng: [number, number], zoom: number, options?: { animate?: false }) => void;
  getZoom: () => number;
  getCenter: () => { lat: number; lng: number };
  fitBounds: (points: [number, number][], options?: { padding?: [number, number]; animate?: false }) => void;
  panTo: (latlng: [number, number]) => void;
  invalidateSize: () => void;
  getPane: (name: string) => object | null;
  addPolyline: (points: [number, number][], style: { color: string; weight: number }) => void;
  addCircle: (position: [number, number], style: {
    radius: number;
    color: string;
    fillColor: string;
    fillOpacity: number;
    weight: number;
  }) => GpsMapMarker;
  addMarker: (position: [number, number], options: { icon: GpsMarkerIcon; autoPanOnFocus?: false; zIndexOffset?: number; interactive?: false }) => GpsMapMarker;
  layerGroup: () => GpsMapLayer;
  remove: () => void;
};

class Marker implements GpsMapMarker {
  private latitude: number;
  private longitude: number;
  private icon: GpsMarkerIcon;
  private clickable: boolean;
  private zIndex: number;
  private opacity = 1;
  private map: GoogleMap | null = null;
  private overlay: GoogleOverlay | null = null;
  private root: HTMLDivElement | null = null;
  private label: HTMLDivElement | null = null;
  private tooltip: { html: string; className: string; offset: [number, number] } | null = null;
  private info: GoogleInfo | null = null;
  private popup: HTMLElement | null = null;
  private popupOpen = false;
  private popupManaged = false;
  private listeners: Record<"click" | "popupopen" | "popupclose", MarkerListener[]> = {
    click: [],
    popupopen: [],
    popupclose: [],
  };

  constructor(position: [number, number], icon: GpsMarkerIcon, options?: { interactive?: boolean; zIndexOffset?: number }) {
    this.latitude = position[0];
    this.longitude = position[1];
    this.icon = icon;
    this.clickable = options?.interactive !== false;
    this.zIndex = options?.zIndexOffset ?? 0;
  }

  addTo(target: GpsMapHandle | GpsMapLayer) {
    if (target instanceof MapHandle) target.placeMarker(this);
    else if (target instanceof Layer) target.placeMarker(this);
    return this;
  }

  attach(map: GoogleMap) {
    if (this.map === map && this.overlay) return;
    this.detach();
    this.map = map;
    const maps = mapsApi();
    const overlay = new maps.OverlayView();
    overlay.onAdd = () => {
      const panes = overlay.getPanes();
      if (!panes) return;
      const root = document.createElement("div");
      root.style.position = "absolute";
      root.addEventListener("click", (event) => this.onClick(event));
      panes.overlayMouseTarget.appendChild(root);
      this.root = root;
      this.paintIcon();
      const label = document.createElement("div");
      label.style.position = "absolute";
      label.style.transform = "translate(-50%, -100%)";
      label.style.pointerEvents = "none";
      panes.floatPane.appendChild(label);
      this.label = label;
      this.paintLabel();
    };
    overlay.draw = () => {
      const projection = overlay.getProjection();
      const point = projection?.fromLatLngToDivPixel(new maps.LatLng(this.latitude, this.longitude));
      if (!point || !this.root) return;
      this.root.style.left = `${point.x}px`;
      this.root.style.top = `${point.y}px`;
      if (!this.label || !this.tooltip) return;
      this.label.style.left = `${point.x + this.tooltip.offset[0]}px`;
      this.label.style.top = `${point.y + this.tooltip.offset[1] - 12}px`;
    };
    overlay.onRemove = () => {
      this.root?.remove();
      this.label?.remove();
      this.root = null;
      this.label = null;
    };
    overlay.setMap(map);
    this.overlay = overlay;
  }

  detach() {
    this.popupOpen = false;
    this.info?.close();
    this.overlay?.setMap(null);
    this.overlay = null;
    this.map = null;
  }

  remove() {
    this.detach();
    this.listeners = { click: [], popupopen: [], popupclose: [] };
  }

  setIcon(icon: GpsMarkerIcon) {
    this.icon = icon;
    this.paintIcon();
  }

  setLatLng(next: [number, number]) {
    this.latitude = next[0];
    this.longitude = next[1];
    this.overlay?.draw();
    if (this.popupOpen) this.info?.setPosition({ lat: this.latitude, lng: this.longitude });
  }

  getLatLng() {
    return { lat: this.latitude, lng: this.longitude };
  }

  setOpacity(value: number) {
    this.opacity = value;
    if (this.root) this.root.style.opacity = String(value);
  }

  setZIndexOffset(offset: number) {
    this.zIndex = offset;
    if (this.root) this.root.style.zIndex = String(offset);
  }

  bindPopup(content: HTMLElement | string) {
    if (typeof content === "string") {
      const node = document.createElement("div");
      node.className = "gps-popup";
      node.innerHTML = content;
      this.popup = node;
    } else {
      this.popup = content;
    }
    if (this.info && this.popup) this.info.setContent(this.popup);
    return this;
  }

  isPopupOpen() {
    return this.popupOpen;
  }

  openPopup() {
    this.popupManaged = true;
    if (!this.map || !this.popup || this.popupOpen) return;
    this.info?.close();
    const maps = mapsApi();
    const anchor = this.icon.popupAnchor ?? [0, -26];
    this.info = new maps.InfoWindow({
      content: this.popup,
      disableAutoPan: true,
      pixelOffset: new maps.Size(anchor[0], anchor[1]),
    });
    this.info.addListener("closeclick", () => {
      if (!this.popupOpen) return;
      this.popupOpen = false;
      this.emit("popupclose");
    });
    this.info.setPosition({ lat: this.latitude, lng: this.longitude });
    this.info.open({ map: this.map, shouldFocus: false });
    this.popupOpen = true;
    this.emit("popupopen");
  }

  closePopup() {
    this.popupManaged = true;
    if (!this.popupOpen) return;
    this.popupOpen = false;
    this.info?.close();
    this.emit("popupclose");
  }

  on(event: "click" | "popupopen" | "popupclose", handler: MarkerListener) {
    this.listeners[event].push(handler);
  }

  off(event: "click") {
    this.listeners[event] = [];
  }

  getTooltip() {
    return this.tooltip;
  }

  unbindTooltip() {
    this.tooltip = null;
    this.paintLabel();
  }

  bindTooltip(html: string, options: { className: string; offset?: [number, number] }) {
    this.tooltip = { html, className: options.className, offset: options.offset ?? [0, -16] };
    this.paintLabel();
    this.overlay?.draw();
  }

  private paintIcon() {
    if (!this.root) return;
    this.root.className = this.icon.className;
    this.root.style.width = `${this.icon.iconSize[0]}px`;
    this.root.style.height = `${this.icon.iconSize[1]}px`;
    this.root.style.transform = `translate(${-this.icon.iconAnchor[0]}px, ${-this.icon.iconAnchor[1]}px)`;
    this.root.style.zIndex = String(this.zIndex);
    this.root.style.opacity = String(this.opacity);
    this.root.style.pointerEvents = this.clickable ? "auto" : "none";
    this.root.innerHTML = this.icon.html;
  }

  private paintLabel() {
    if (!this.label) return;
    if (!this.tooltip?.html) {
      this.label.replaceChildren();
      this.label.className = "";
      return;
    }
    this.label.className = this.tooltip.className;
    this.label.innerHTML = this.tooltip.html;
  }

  private onClick(event: Event) {
    event.stopPropagation();
    this.popupManaged = false;
    this.emit("click", { originalEvent: event });
    if (!this.popupManaged) this.openPopup();
  }

  private emit(event: "click" | "popupopen" | "popupclose", payload?: { originalEvent?: Event }) {
    for (const handler of this.listeners[event]) handler(payload);
  }
}

class Layer implements GpsMapLayer {
  private map: MapHandle | null = null;
  private markers: Marker[] = [];

  placeMarker(marker: Marker) {
    this.markers.push(marker);
    if (this.map) this.map.placeMarker(marker);
  }

  addTo(map: GpsMapHandle) {
    if (!(map instanceof MapHandle)) return;
    this.map = map;
    for (const marker of this.markers) map.placeMarker(marker);
  }

  remove() {
    for (const marker of this.markers) marker.detach();
    this.map = null;
  }
}

class MapHandle implements GpsMapHandle {
  readonly native: GoogleMap;
  private readonly maps: GoogleNamespace["maps"];
  private readonly node: HTMLElement;
  private readonly listeners: ListenerHandle[] = [];
  private readonly polylines: GooglePolyline[] = [];
  private readonly markers: Marker[] = [];
  private quiet = 0;
  private removed = false;

  constructor(native: GoogleMap, maps: GoogleNamespace["maps"], node: HTMLElement, onAuthFailure?: () => void) {
    this.native = native;
    this.maps = maps;
    this.node = node;
    native.setOptions({ maxZoom: 19 });
    if (onAuthFailure) {
      const fail = () => {
        if (this.removed) return;
        const message = node.querySelector(".gm-err-message, .gm-err-title, .gm-err-container")?.textContent ?? "";
        const clean = message.replace(/AIza[0-9A-Za-z_\-]{10,}/g, "").replace(/\s+/g, " ").trim();
        const code = ["RefererNotAllowedMapError", "ApiNotActivatedMapError", "InvalidKeyMapError", "MissingKeyMapError", "ExpiredKeyMapError"]
          .find((name) => clean.includes(name));
        node.dataset.mapError = code ?? node.dataset.mapError ?? "google-error";
        node.dataset.mapDetail = clean.slice(0, 160);
        onAuthFailure();
        this.remove();
      };
      authFailures.add(fail);
      const observer = new MutationObserver(() => {
        if (node.querySelector(".gm-err-container, .gm-err-message")) fail();
      });
      observer.observe(node, { childList: true, subtree: true });
      if (node.querySelector(".gm-err-container, .gm-err-message")) fail();
      this.listeners.push({ remove: () => {
        authFailures.delete(fail);
        observer.disconnect();
      } });
    }
  }

  on(event: "dragstart" | "zoomstart", handler: MapListener) {
    const name = event === "zoomstart" ? "zoom_changed" : event;
    this.listeners.push(this.native.addListener(name, () => {
      if (event === "zoomstart" && this.quiet > 0) return;
      handler();
    }));
  }

  setView(latlng: [number, number], zoom: number) {
    this.quietly(() => {
      this.native.setCenter({ lat: latlng[0], lng: latlng[1] });
      this.native.setZoom(zoom);
    });
  }

  getZoom() {
    return this.native.getZoom() ?? 10;
  }

  getCenter() {
    const center = this.native.getCenter();
    if (!center) return { lat: 41.015, lng: 28.979 };
    return { lat: center.lat(), lng: center.lng() };
  }

  fitBounds(points: [number, number][], options?: { padding?: [number, number] }) {
    const bounds = new this.maps.LatLngBounds();
    for (const point of points) bounds.extend(new this.maps.LatLng(point[0], point[1]));
    this.quietly(() => this.native.fitBounds(bounds, options?.padding?.[0] ?? 24));
  }

  panTo(latlng: [number, number]) {
    this.native.panTo({ lat: latlng[0], lng: latlng[1] });
  }

  invalidateSize() {
    this.maps.event.trigger(this.native, "resize");
  }

  getPane() {
    return this.removed ? null : this.node;
  }

  addPolyline(points: [number, number][], style: { color: string; weight: number }) {
    const line = new this.maps.Polyline({
      map: this.native,
      path: points.map(([lat, lng]) => ({ lat, lng })),
      strokeColor: style.color,
      strokeWeight: style.weight,
      clickable: false,
      geodesic: true,
    });
    this.polylines.push(line);
  }

  addCircle(position: [number, number], style: { radius: number; color: string; fillColor: string; fillOpacity: number; weight: number }) {
    const diameter = style.radius * 2;
    return new Marker(position, {
      className: "gps-history-dot",
      html: `<span style="display:block;box-sizing:content-box;width:${diameter}px;height:${diameter}px;border-radius:50%;background:${style.fillColor};opacity:${style.fillOpacity};border:${style.weight}px solid ${style.color}"></span>`,
      iconSize: [diameter + style.weight * 2, diameter + style.weight * 2],
      iconAnchor: [(diameter + style.weight * 2) / 2, (diameter + style.weight * 2) / 2],
    });
  }

  addMarker(position: [number, number], options: { icon: GpsMarkerIcon; zIndexOffset?: number; interactive?: false }) {
    return new Marker(position, options.icon, {
      interactive: options.interactive !== false,
      zIndexOffset: options.zIndexOffset,
    });
  }

  placeMarker(marker: Marker) {
    this.markers.push(marker);
    marker.attach(this.native);
  }

  layerGroup() {
    return new Layer();
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    for (const listener of this.listeners) listener.remove();
    for (const marker of this.markers) marker.detach();
    for (const line of this.polylines) line.setMap(null);
    this.node.replaceChildren();
  }

  private quietly(run: () => void) {
    this.quiet += 1;
    run();
    window.setTimeout(() => {
      this.quiet = Math.max(0, this.quiet - 1);
    }, 250);
  }
}

const MAP_ERROR_CODES = ["RefererNotAllowedMapError", "ApiNotActivatedMapError", "InvalidKeyMapError", "MissingKeyMapError", "ExpiredKeyMapError"];

function watchMapConsole(node: HTMLElement) {
  const previous = console.error;
  console.error = (...args: unknown[]) => {
    const text = args.map((item) => String(item)).join(" ");
    const code = MAP_ERROR_CODES.find((name) => text.includes(name));
    if (code) node.dataset.mapError = code;
    previous.apply(console, args as []);
  };
}

export async function mountGoogleMap(node: HTMLElement, onAuthFailure?: () => void) {
  watchMapConsole(node);
  const google = await loadGoogleMaps();
  const maps = google.maps ?? mapsApi();
  window.__tripeticaGoogleMapCreates = (window.__tripeticaGoogleMapCreates ?? 0) + 1;
  let map: GoogleMap;
  try {
    map = new maps.Map(node, {
      center: { lat: 41.015, lng: 28.979 },
      zoom: 10,
      mapTypeId: "roadmap",
      clickableIcons: true,
      gestureHandling: "greedy",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = ["RefererNotAllowedMapError", "ApiNotActivatedMapError", "InvalidKeyMapError", "MissingKeyMapError", "ExpiredKeyMapError"]
      .find((name) => message.includes(name));
    node.dataset.mapError = code ?? "map-constructor";
    throw error;
  }
  return new MapHandle(map, maps, node, onAuthFailure);
}
