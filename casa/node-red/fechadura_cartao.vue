<template>
  <div class="fx" v-if="d">
    <div v-if="d.erro" class="fx-erro">{{ d.erro }}</div>

    <div class="fx-anel" :class="cor" @pointerdown.prevent="segurar" @pointerup="soltar" @pointerleave="soltar" @pointercancel="soltar">
      <svg class="fx-prog" viewBox="0 0 210 210">
        <circle cx="105" cy="105" r="100" class="fx-trilho" />
        <circle cx="105" cy="105" r="100" class="fx-barra" :style="{ strokeDashoffset: 628 - 628 * progresso, opacity: progresso > 0 ? 1 : 0 }" />
      </svg>
      <div class="fx-ic">
        <svg v-if="!aberta" width="70" height="78" viewBox="0 0 24 26"><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="3.5" y="11" width="17" height="13" rx="3" class="fx-corpo" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="17" r="2" fill="currentColor"/></svg>
        <svg v-else width="70" height="78" viewBox="0 0 24 26"><path d="M7 11V7a5 5 0 0 1 9.6-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="3.5" y="11" width="17" height="13" rx="3" class="fx-corpo" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="17" r="2" fill="currentColor"/></svg>
        <div class="fx-estado">{{ textoEstado }}</div>
      </div>
    </div>
    <div class="fx-dica">{{ dica }}</div>

    <div class="fx-chips">
      <div class="fx-chip"><span>🚪 Porta</span><b>{{ d.porta }}</b></div>
      <div class="fx-chip"><span>🔋 Bateria</span><b>{{ d.bateria ? d.bateria + '%' : '—' }}</b></div>
      <div class="fx-chip"><span>🛡️ Trava</span><b>{{ d.travaInterna ? 'Ligada' : 'Desligada' }}</b></div>
    </div>

    <div class="fx-hist-tit">Últimos eventos</div>
    <div v-if="!d.historico.length" class="fx-vazio">Nenhum evento ainda</div>
    <div v-for="(e, i) in d.historico" :key="i" class="fx-ev">
      <span class="fx-bx" :style="{ background: estilo(e).cor }">{{ estilo(e).ic }}</span>
      <span class="fx-txt">{{ limpa(e.txt) }}</span>
      <span class="fx-hora">{{ e.quando }}</span>
    </div>
  </div>
  <div v-else class="fx-vazio">Lendo a fechadura...</div>
</template>

<script>
export default {
  data() { return { progresso: 0, timer: null, abrindo: false } },
  watch: { msg() { if (this.abrindo && this.d && (this.d.erro || this.d.porta === 'Aberta')) this.abrindo = false } },
  computed: {
    d() { return this.msg && this.msg.payload && this.msg.payload.porta ? this.msg.payload : null },
    aberta() { return this.abrindo || (this.d && this.d.porta === 'Aberta') },
    cor() { return this.abrindo ? 'abrindo' : this.aberta ? 'aberta' : 'trancada' },
    textoEstado() { return this.abrindo ? 'ABRINDO...' : this.aberta ? 'ABERTA' : 'TRANCADA' },
    dica() { return this.abrindo ? 'Enviando para a fechadura...' : this.progresso > 0 ? 'Continue segurando...' : 'Segure o cadeado para abrir' }
  },
  methods: {
    segurar() {
      if (this.abrindo) return;
      const inicio = Date.now();
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        this.progresso = Math.min(1, (Date.now() - inicio) / 1000);
        if (this.progresso >= 1) {
          clearInterval(this.timer); this.timer = null;
          this.abrindo = true; this.progresso = 0;
          if (navigator.vibrate) navigator.vibrate(80);
          this.send({ topic: 'abrir', payload: true });
          setTimeout(() => { this.abrindo = false }, 15000);
        }
      }, 30);
    },
    soltar() { if (this.timer) { clearInterval(this.timer); this.timer = null; } this.progresso = 0; },
    limpa(t) { return String(t || '').replace(/^\S+\s/, '') },
    estilo(e) {
      const t = String(e.txt || '');
      if (/coação|ARROMBAMENTO|Alarme|Bateria/i.test(t)) return { ic: '⚠️', cor: '#b71c1c' };
      if (/campainha/i.test(t)) return { ic: '🔔', cor: '#0d47a1' };
      if (/Aberta por|dashboard|entrou/i.test(t)) return { ic: '🔓', cor: '#1b5e20' };
      if (/Porta aberta/i.test(t)) return { ic: '🚪', cor: '#e65100' };
      return { ic: '🚪', cor: '#37474f' };
    }
  },
  unmounted() { clearInterval(this.timer) }
}
</script>

<style>
.fx { width: 100%; color: #eee; }
.fx-erro { color: #ff8a80; font-size: 14px; font-weight: 600; padding: 6px 0 10px; text-align: center; }
.fx-anel { width: 190px; height: 190px; margin: 6px auto 6px; border-radius: 50%; position: relative; cursor: pointer;
  user-select: none; -webkit-user-select: none; touch-action: none; transition: box-shadow .3s, background .3s; }
.fx-anel.trancada { color: #69f0ae; background: radial-gradient(circle at 50% 40%, rgba(76,175,80,.25), rgba(0,0,0,.2) 70%);
  box-shadow: 0 0 0 3px rgba(76,175,80,.35), 0 0 30px rgba(76,175,80,.45), inset 0 0 25px rgba(76,175,80,.25); }
.fx-anel.aberta, .fx-anel.abrindo { color: #ffb74d; background: radial-gradient(circle at 50% 40%, rgba(255,152,0,.25), rgba(0,0,0,.2) 70%);
  box-shadow: 0 0 0 3px rgba(255,152,0,.4), 0 0 30px rgba(255,152,0,.5), inset 0 0 25px rgba(255,152,0,.25); }
.fx-anel.trancada .fx-corpo { fill: #1b5e20; }
.fx-anel.aberta .fx-corpo, .fx-anel.abrindo .fx-corpo { fill: #6d3d00; }
.fx-anel:active { transform: scale(.98); }
.fx-prog { position: absolute; inset: -10px; width: 210px; height: 210px; transform: rotate(-90deg); pointer-events: none; }
.fx-trilho { fill: none; stroke: transparent; stroke-width: 5; }
.fx-barra { fill: none; stroke: currentColor; stroke-width: 6; stroke-linecap: round; stroke-dasharray: 628; }
.fx-ic { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
.fx-estado { font-size: 22px; font-weight: 800; margin-top: 6px; letter-spacing: 1px; text-shadow: 0 0 12px currentColor; }
.fx-dica { text-align: center; font-size: 14px; color: #bbb; margin-bottom: 14px; }
.fx-chips { display: flex; gap: 8px; margin-bottom: 16px; }
.fx-chip { flex: 1; border-radius: 12px; padding: 9px 4px; text-align: center; background: linear-gradient(160deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
  border: 1px solid rgba(255,255,255,.1); }
.fx-chip span { display: block; font-size: 12px; color: #aaa; }
.fx-chip b { display: block; font-size: 15px; color: #fff; margin-top: 2px; }
.fx-hist-tit { font-size: 14px; color: #aaa; margin-bottom: 4px; font-weight: 600; }
.fx-ev { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.07);
  font-family: "Segoe UI", Roboto, Arial, sans-serif; font-size: 15px; color: #fff; -webkit-font-smoothing: antialiased; }
.fx-bx { width: 30px; height: 30px; flex: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
.fx-txt { flex: 1; line-height: 1.25; }
.fx-hora { color: #9e9e9e; font-size: 13px; white-space: nowrap; }
.fx-vazio { color: #aaa; font-size: 14px; padding: 6px 0; }
</style>
