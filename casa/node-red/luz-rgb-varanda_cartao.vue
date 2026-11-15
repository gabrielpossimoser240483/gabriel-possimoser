<template>
  <div class="rg" v-if="e">
    <div class="rg-topo">
      <div class="rg-lamp" :class="{ on: e.ligada }" :style="brilhoEstilo" @click="enviar('onoff', !e.ligada)">
        <v-icon :icon="e.ligada ? 'mdi-lightbulb-on' : 'mdi-lightbulb-outline'" size="44"></v-icon>
      </div>
      <div class="rg-info">
        <b>{{ e.ligada ? 'Ligada' : 'Desligada' }}</b>
        <span>{{ e.modo === 'cor' ? 'Colorida' : 'Branco' }} · {{ e.brilho }}%</span>
        <span class="rg-toque">Toque na lâmpada para {{ e.ligada ? 'apagar' : 'acender' }}</span>
      </div>
    </div>

    <div class="rg-modos">
      <button :class="{ ativo: e.modo === 'branco' }" @click="enviar('modo', 'branco')">☀️ Branco</button>
      <button :class="{ ativo: e.modo === 'cor' }" @click="enviar('modo', 'cor')">🌈 Colorida</button>
    </div>

    <div class="rg-linha"><span>Brilho</span>
      <input type="range" min="1" max="100" :value="e.brilho" @change="enviar('brilho', +$event.target.value)" class="rg-range rg-bri">
      <b>{{ e.brilho }}%</b></div>

    <div v-if="e.modo === 'branco'" class="rg-linha"><span>Quente ↔ Frio</span>
      <input type="range" min="0" max="100" :value="e.temperatura" @change="enviar('temperatura', +$event.target.value)" class="rg-range rg-temp"></div>

    <div v-else>
      <div class="rg-cores">
        <div v-for="c in cores" :key="c" class="rg-cor" :class="{ sel: perto(c) }" :style="{ background: c }" @click="enviar('cor', c)"></div>
        <label class="rg-cor rg-livre" title="Escolher outra cor"><input type="color" :value="e.cor" @change="enviar('cor', $event.target.value)">🎨</label>
      </div>
      <button class="rg-uv" :class="{ sel: perto(uv) }" @click="enviar('cor', uv)">🟣 Violeta (efeito UV)</button>
    </div>
  </div>
  <div v-else class="rg-vazio">Lendo a lâmpada...</div>
</template>

<script>
export default {
  data() { return { uv: '#5200ff', cores: ['#ff0000', '#ff7a00', '#ffd400', '#00e000', '#00e5ff', '#0040ff', '#8a2be2', '#ff00c8', '#ffffff'] } },
  computed: {
    e() { return this.msg && this.msg.payload && this.msg.payload.modo ? this.msg.payload : null },
    brilhoEstilo() {
      if (!this.e || !this.e.ligada) return {};
      const c = this.e.modo === 'cor' ? this.e.cor : (this.e.temperatura > 50 ? '#e8f4ff' : '#ffd59a');
      return { color: c, boxShadow: `0 0 ${10 + this.e.brilho / 3}px ${c}, inset 0 0 18px ${c}55`, borderColor: c };
    }
  },
  methods: {
    enviar(topic, payload) { this.send({ topic, payload }); },
    perto(c) { return this.e && this.e.cor && this.e.cor.toLowerCase() === c.toLowerCase(); }
  }
}
</script>

<style>
.rg { width: 100%; color: #eee; font-family: "Segoe UI", Roboto, Arial, sans-serif; }
.rg-topo { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
.rg-lamp { width: 84px; height: 84px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;
  color: #777; background: radial-gradient(circle at 50% 40%, rgba(255,255,255,.08), rgba(0,0,0,.3)); border: 2px solid #444; transition: all .3s; user-select: none; }
.rg-lamp:active { transform: scale(.95); }
.rg-info b { display: block; font-size: 20px; }
.rg-info span { display: block; font-size: 14px; color: #bbb; margin-top: 2px; }
.rg-info .rg-toque { font-size: 12px; color: #888; }
.rg-modos { display: flex; gap: 8px; margin-bottom: 14px; }
.rg-modos button { flex: 1; padding: 10px; border-radius: 12px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); color: #ddd; font-size: 14px; font-weight: 600; }
.rg-modos button.ativo { background: rgba(255,193,7,.18); border-color: #ffc107; color: #ffe082; }
.rg-linha { display: flex; align-items: center; gap: 10px; margin: 10px 0; font-size: 14px; }
.rg-linha span { width: 96px; color: #ccc; }
.rg-linha b { width: 42px; text-align: right; }
.rg-range { flex: 1; -webkit-appearance: none; appearance: none; height: 10px; border-radius: 6px; outline: none; }
.rg-range::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: #fff; border: 2px solid #333; cursor: pointer; }
.rg-range::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 2px solid #333; }
.rg-bri { background: linear-gradient(90deg, #222, #fff); }
.rg-temp { background: linear-gradient(90deg, #ffb347, #fff6e5, #cfe8ff); }
.rg-cores { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
.rg-cor { width: 38px; height: 38px; border-radius: 50%; cursor: pointer; border: 2px solid rgba(255,255,255,.25); position: relative;
  display: flex; align-items: center; justify-content: center; font-size: 18px; }
.rg-cor.sel { border: 3px solid #fff; box-shadow: 0 0 10px #fff; }
.rg-livre { background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red); }
.rg-livre input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.rg-uv { width: 100%; margin-top: 12px; padding: 11px; border-radius: 12px; font-size: 15px; font-weight: 700; color: #e6d6ff;
  background: radial-gradient(circle at 30% 50%, rgba(140,60,255,.55), rgba(40,0,90,.85)); border: 1px solid #7c4dff; box-shadow: 0 0 14px rgba(124,77,255,.6); }
.rg-uv.sel { border: 2px solid #fff; }
.rg-vazio { color: #aaa; font-size: 14px; }
</style>
