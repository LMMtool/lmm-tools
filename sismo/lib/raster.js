// ============================================================
// SISMOPANAMA - Carga y consulta de rásters Sa
// ============================================================

class SaRaster {
  constructor(jsonData) {
    this.meta = jsonData.meta;
    this.data = this._decode(jsonData.data);
  }

  _decode(b64string) {
    // Decode base64 -> bytes
    const binStr = atob(b64string);
    const compressed = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      compressed[i] = binStr.charCodeAt(i);
    }
    // Decompress zlib using pako (lightweight)
    const raw = pako.inflate(compressed);
    // Reinterpretar como Uint16Array
    return new Uint16Array(raw.buffer);
  }

  // Consulta valor por coordenadas lat/lng
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

  // Genera puntos para renderizar contornos como heatmap
  *iterate() {
    const { width, height, origin_lng, origin_lat, res, scale_factor } = this.meta;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const val = this.data[row * width + col];
        if (val === 0) continue;
        const lat = origin_lat - row * res;
        const lng = origin_lng + col * res;
        yield { lat, lng, value: val / scale_factor };
      }
    }
  }

  // Devuelve bounds del raster
  getBounds() {
    return {
      west: this.meta.origin_lng,
      east: this.meta.origin_lng + this.meta.width * this.meta.res,
      south: this.meta.origin_lat - this.meta.height * this.meta.res,
      north: this.meta.origin_lat
    };
  }
}

// Manager para los 3 rásters
class RasterManager {
  constructor() {
    this.rasters = {};
    this.loaded = false;
  }

  async loadAll(version = 'v1.0') {
    const names = ['pga', 'ss', 's1'];
    const results = await Promise.all(
      names.map(n => fetch(`data/${version}/${n}.json`).then(r => r.json()))
    );
    names.forEach((n, i) => {
      this.rasters[n] = new SaRaster(results[i]);
    });
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

  getBounds() {
    return this.rasters.pga.getBounds();
  }
}

window.RasterManager = RasterManager;
