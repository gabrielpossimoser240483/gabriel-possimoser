<template>
  <div class="lp" v-if="d">
    <div class="lp-topo">
      <div class="lp-led" :class="{ on: d.led }" @click="send({ topic: 'led', payload: !d.led })">
        <svg width="46" height="46" viewBox="0 0 24 24"><path d="M9 21h6M10 18h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="lp-info">
        <b>{{ d.led ? 'LED aceso' : 'LED apagado' }}</b>
        <span>Toque no LED para {{ d.led ? 'apagar' : 'acender' }}</span>
      </div>
    </div>

    <div class="lp-horario" :class="{ off: !d.auto }">
      <div class="lp-horas">
        <div class="lp-h"><span>🌙 Acende</span><b>{{ hm(ini) }}</b></div>
        <div class="lp-dur">{{ duracao }}</div>
        <div class="lp-h"><span>💤 Apaga</span><b>{{ hm(fim) }}</b></div>
      </div>
      <div class="lp-trilho">
        <div class="lp-faixa" :style="faixa"></div>
        <input type="range" class="lp-r" :min="0" :max="SPAN" step="15" :value="pos(ini)"
               @input="mover('ini', $event)" @change="salvar">
        <input type="range" class="lp-r" :min="0" :max="SPAN" step="15" :value="pos(fim)"
               @input="mover('fim', $event)" @change="salvar">
      </div>
      <div class="lp-escala"><span>15h</span><span>18h</span><span>21h</span><span>0h</span><span>3h</span><span>7h</span></div>
      <div class="lp-dica">Arraste as bolinhas para escolher os horários</div>
    </div>

    <div class="lp-auto" :class="{ on: d.auto }" @click="send({ topic: 'chave', payload: !d.auto })">
      <div class="lp-auto-txt"><b>Automático</b><span>{{ d.prox }}</span></div>
      <div class="lp-sw"><i></i></div>
    </div>
  </div>
  <div v-else class="lp-vazio">Carregando...</div>
</template>

<script>
export default {
  data() { return { BASE: 15 * 60, SPAN: 16 * 60, ini: 18 * 60 + 30, fim: 23 * 60, mexendo: false } },
  watch: { msg: { immediate: true, handler() { if (this.d && !this.mexendo) { this.ini = this.d.inicio; this.fim = this.d.fim; } } } },
  computed: {
    d() { return this.msg && this.msg.payload && this.msg.payload.prox !== undefined ? this.msg.payload : null },
    faixa() { const a = this.pos(this.ini) / this.SPAN * 100, b = this.pos(this.fim) / this.SPAN * 100;
      return { left: Math.min(a, b) + '%', width: Math.abs(b - a) + '%' }; },
    duracao() { let m = (this.fim - this.ini + 1440) % 1440; return Math.floor(m / 60) + 'h' + (m % 60 ? String(m % 60).padStart(2, '0') : ''); }
  },
  methods: {
    pos(m) { return (m - this.BASE + 1440) % 1440 },
    hm(m) { return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') },
    mover(qual, ev) {
      this.mexendo = true;
      let p = +ev.target.value;
      const outro = this.pos(qual === 'ini' ? this.fim : this.ini);
      if (qual === 'ini' && p > outro - 15) p = outro - 15;
      if (qual === 'fim' && p < outro + 15) p = outro + 15;
      ev.target.value = p;
      this[qual] = (p + this.BASE) % 1440;
    },
    salvar() { this.mexendo = false; this.send({ topic: 'horario', payload: { inicio: this.ini, fim: this.fim } }); }
  }
}
</script>

<style>
.lp { width: 100%; color: #eee; font-family: "Segoe UI", Roboto, Arial, sans-serif; }
.lp-topo { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.lp-led { width: 84px; height: 84px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;
  color: #777; border: 2px solid #444; background: radial-gradient(circle at 50% 40%, rgba(255,255,255,.07), rgba(0,0,0,.3)); transition: all .3s; user-select: none; }
.lp-led.on { color: #ffe082; border-color: #ffc107; background: radial-gradient(circle at 50% 40%, rgba(255,193,7,.35), rgba(60,40,0,.4));
  box-shadow: 0 0 26px rgba(255,193,7,.6), inset 0 0 18px rgba(255,193,7,.35); }
.lp-led:active { transform: scale(.95); }
.lp-info b { display: block; font-size: 20px; }
.lp-info span { display: block; font-size: 13px; color: #999; margin-top: 3px; }
.lp-horario { padding: 12px 14px 10px; border-radius: 14px; margin-bottom: 12px;
  background: linear-gradient(160deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); border: 1px solid rgba(255,255,255,.1); transition: opacity .3s; }
.lp-horario.off { opacity: .45; }
.lp-horas { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 10px; }
.lp-h span { display: block; font-size: 12px; color: #aaa; }
.lp-h:last-child { text-align: right; }
.lp-h b { display: block; font-size: 24px; color: #ffe082; letter-spacing: 1px; }
.lp-dur { font-size: 13px; color: #ffcc80; padding: 3px 10px; border-radius: 10px; background: rgba(255,193,7,.12); margin-bottom: 4px; }
.lp-trilho { position: relative; height: 30px; }
.lp-trilho:before { content: ""; position: absolute; left: 0; right: 0; top: 11px; height: 8px; border-radius: 4px; background: rgba(255,255,255,.12); }
.lp-faixa { position: absolute; top: 11px; height: 8px; border-radius: 4px; background: linear-gradient(90deg, #ffb300, #ffe082); box-shadow: 0 0 10px #ffc107; }
.lp-r { position: absolute; left: 0; top: 0; width: 100%; height: 30px; margin: 0; background: none; pointer-events: none; -webkit-appearance: none; appearance: none; }
.lp-r::-webkit-slider-runnable-track { background: none; height: 30px; }
.lp-r::-webkit-slider-thumb { -webkit-appearance: none; pointer-events: auto; width: 26px; height: 26px; margin-top: 2px; border-radius: 50%;
  background: #fff; border: 3px solid #ffb300; box-shadow: 0 0 8px rgba(255,193,7,.8); cursor: grab; }
.lp-r::-moz-range-track { background: none; }
.lp-r::-moz-range-thumb { pointer-events: auto; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 3px solid #ffb300; cursor: grab; }
.lp-escala { display: flex; justify-content: space-between; font-size: 11px; color: #888; margin-top: 2px; }
.lp-dica { font-size: 12px; color: #888; text-align: center; margin-top: 6px; }
.lp-auto { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; cursor: pointer; user-select: none;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); transition: all .3s; }
.lp-auto.on { background: rgba(76,175,80,.14); border-color: rgba(105,240,174,.55); box-shadow: 0 0 14px rgba(76,175,80,.3); }
.lp-auto-txt { flex: 1; }
.lp-auto-txt b { display: block; font-size: 16px; }
.lp-auto-txt span { display: block; font-size: 13px; color: #aaa; margin-top: 2px; }
.lp-auto.on .lp-auto-txt span { color: #a5d6a7; }
.lp-sw { width: 50px; height: 28px; border-radius: 14px; background: #555; position: relative; transition: background .3s; flex: none; }
.lp-sw i { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: left .3s; }
.lp-auto.on .lp-sw { background: #43a047; }
.lp-auto.on .lp-sw i { left: 25px; }
.lp-vazio { color: #aaa; font-size: 14px; }
</style>
