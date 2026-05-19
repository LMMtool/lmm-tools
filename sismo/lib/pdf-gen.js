// ============================================================
// SISMOPANAMA v1.0.3 - Carga y consulta de rásters Sa
// © LMM Ingeniería 2026
// ============================================================

class SaRaster {
  constructor(jsonData) {
    this.meta = jsonData.meta;
    this.data = this._decode(jsonData.data);
  }

  _decode(b64string) {
    const binStr = atob(b64string);
    const compressed = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      compressed[i] = binStr.charCodeAt(i);
    }
    const raw = pako.inflate(compressed);
    return new Uint16Array(raw.buffer);
  }

  query(lat, lng) {
    const col = Math.round((lng - this.meta.origin_lng) / this.meta.res);
    const row = Math.round((this.meta.origin_lat - lat) / this.meta.res);
    if (row < 0 || row >= this.meta.height || col < 0 || col >= this.meta.width) {
      return null;
    }
    const idx = row * this.meta.width + col;
    const val = this.data[idx];
    if (val === 0) return null;
    return val / this.meta.scale_factor;
  }

  getBounds() {
    return {
      west: this.meta.origin_lng,
      east: this.meta.origin_lng + this.meta.width * this.meta.res,
      south: this.meta.origin_lat - this.meta.height * this.meta.res,
      north: this.meta.origin_lat
    };
  }
}

class RasterManager {
  constructor() {
    this.rasters = {};
    this.contours = null;
    this.loaded = false;
  }

  async loadAll(version = 'v1.0') {
    const [pga, ss, s1, contours] = await Promise.all([
      fetch(`data/${version}/pga.json`).then(r => r.json()),
      fetch(`data/${version}/ss.json`).then(r => r.json()),
      fetch(`data/${version}/s1.json`).then(r => r.json()),
      fetch(`data/${version}/contours.json`).then(r => r.json())
    ]);
    this.rasters.pga = new SaRaster(pga);
    this.rasters.ss = new SaRaster(ss);
    this.rasters.s1 = new SaRaster(s1);
    this.contours = contours;
    this.loaded = true;
    return this;
  }

  queryAll(lat, lng) {
    return {
      pga: this.rasters.pga.query(lat, lng),
      ss:  this.rasters.ss.query(lat, lng),
      s1:  this.rasters.s1.query(lat, lng)
    };
  }

  // Devuelve las curvas combinadas (oficial + nacional)
  // El visor las renderiza una capa primero, otra encima
  getContours(layer) {
    if (!this.contours || !this.contours[layer]) return null;
    return this.contours[layer]; // { oficial: [...], nacional: [...] }
  }
}

window.RasterManager = RasterManager;
