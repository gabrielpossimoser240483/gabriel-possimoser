<template>
  <div class="i3d">
    <div v-if="!e || !e.cfg.temUrl" class="i3d-vazio">Configure a impressora para ver a câmera.</div>
    <template v-else>
      <div class="i3d-cam" :class="{ cheia }" @click="cheia = !cheia" title="Clique para ampliar">
        <img v-if="ligada" :key="modo" :src="src" @load="carregou" @error="falhou" alt="Câmera da impressora">
        <div v-if="!ligada" class="i3d-cam-aviso">Câmera pausada</div>
        <div v-else-if="erro" class="i3d-cam-aviso">Câmera indisponível<br><small>{{ modo === 'stream' ? 'o navegador não alcança o vídeo' : 'verifique o endereço da câmera' }}</small></div>
        <span v-if="ligada && !erro && ultimaFoto && modo !== 'stream'" class="i3d-cam-hora">{{ ultimaFoto }}</span>
      </div>
      <div class="i3d-linha" style="margin-top:8px">
        <v-btn size="small" variant="tonal" :prepend-icon="ligada ? 'mdi-pause' : 'mdi-play'" @click="alternar">{{ ligada ? 'Parar câmera' : 'Ligar câmera' }}</v-btn>
        <v-btn size="small" variant="tonal" prepend-icon="mdi-fullscreen" @click="cheia = !cheia">Ampliar</v-btn>
        <v-btn size="small" variant="tonal" prepend-icon="mdi-camera" :href="foto" target="_blank">Foto</v-btn>
        <v-btn-toggle v-model="modo" density="compact" variant="outlined" mandatory divided>
          <v-btn value="snapshot" size="small">Fotos</v-btn>
          <v-btn value="stream" size="small">Vídeo</v-btn>
        </v-btn-toggle>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  data() { return { ts: Date.now(), ligada: true, erro: false, cheia: false, modo: null, timer: null, ultimaFoto: '' } },
  computed: {
    e() { return this.msg && this.msg.payload && this.msg.payload.cfg ? this.msg.payload : null },
    base() { return window.location.pathname.replace(/\/[^/]*\/[^/]*\/?$/, '/') },
    foto() { return this.base + 'impressora3d/webcam?t=' + this.ts },
    src() { return this.modo === 'stream' && this.e.cfg.webcamStream ? this.e.cfg.webcamStream : this.foto }
  },
  watch: {
    e(v) { if (v && !this.modo) this.modo = v.cfg.webcamModo === 'stream' ? 'stream' : 'snapshot' },
    modo() { this.erro = false; this.agendar() }
  },
  mounted() { if (this.e && !this.modo) this.modo = this.e.cfg.webcamModo === 'stream' ? 'stream' : 'snapshot' },
  unmounted() { clearTimeout(this.timer) },
  methods: {
    agendar() {
      clearTimeout(this.timer)
      if (!this.ligada || this.modo === 'stream') return
      const s = (this.e && Number(this.e.cfg.webcamIntervalo)) || 2
      this.timer = setTimeout(() => { if (!document.hidden) this.ts = Date.now(); else this.agendar() }, s * 1000)
    },
    carregou() { this.erro = false; this.ultimaFoto = new Date().toLocaleTimeString('pt-BR'); this.agendar() },
    falhou() { this.erro = true; clearTimeout(this.timer); this.timer = setTimeout(() => { this.ts = Date.now() }, 10000) },
    alternar() { this.ligada = !this.ligada; if (this.ligada) { this.ts = Date.now() } else clearTimeout(this.timer) }
  }
}
</script>

<style>
.i3d-cam { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #111; border-radius: 6px; overflow: hidden; cursor: zoom-in; }
.i3d-cam img { width: 100%; height: 100%; object-fit: contain; display: block; }
.i3d-cam.cheia { position: fixed; inset: 0; z-index: 3000; aspect-ratio: auto; border-radius: 0; cursor: zoom-out; }
.i3d-cam-aviso { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #9aa0a6; text-align: center; }
.i3d-cam-hora { position: absolute; right: 6px; bottom: 6px; font-size: 11px; color: #fff; background: rgba(0,0,0,.5); padding: 1px 6px; border-radius: 4px; }
</style>
