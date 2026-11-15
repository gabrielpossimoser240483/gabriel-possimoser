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
      <div class="lp-h"><span>🌙 Acende</span><b>18:30</b></div>
      <div class="lp-seta">
        <div class="lp-barra"><i :style="{ width: progresso + '%' }"></i></div>
      </div>
      <div class="lp-h"><span>💤 Apaga</span><b>23:00</b></div>
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
  data() { return { agora: Date.now(), t: null } },
  mounted() { this.t = setInterval(() => { this.agora = Date.now() }, 60000) },
  unmounted() { clearInterval(this.t) },
  computed: {
    d() { return this.msg && this.msg.payload && this.msg.payload.prox !== undefined ? this.msg.payload : null },
    progresso() {
      const n = new Date(this.agora), m = n.getHours() * 60 + n.getMinutes(), a = 18 * 60 + 30, b = 23 * 60;
      return m < a ? 0 : m >= b ? 100 : Math.round((m - a) / (b - a) * 100);
    }
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
.lp-horario { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 14px; margin-bottom: 12px;
  background: linear-gradient(160deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); border: 1px solid rgba(255,255,255,.1); transition: opacity .3s; }
.lp-horario.off { opacity: .4; }
.lp-h { text-align: center; }
.lp-h span { display: block; font-size: 12px; color: #aaa; }
.lp-h b { display: block; font-size: 22px; color: #ffe082; letter-spacing: 1px; }
.lp-seta { flex: 1; }
.lp-barra { height: 8px; border-radius: 4px; background: rgba(255,255,255,.1); overflow: hidden; }
.lp-barra i { display: block; height: 100%; background: linear-gradient(90deg, #ffb300, #ffe082); box-shadow: 0 0 8px #ffc107; }
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
