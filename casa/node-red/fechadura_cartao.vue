<template>
  <div class="fx-erro" v-if="msg && msg.payload && msg.payload.erro">{{ msg.payload.erro }}</div>
  <div class="fx" v-if="msg && msg.payload && msg.payload.porta">
    <div v-if="!confirmar" class="fx-abrir" @click="confirmar = true"><v-icon icon="mdi-lock-open-variant" size="26"></v-icon> ABRIR A PORTA</div>
    <div v-else class="fx-confirma">
      <span>Abrir a porta agora?</span>
      <button class="fx-sim" @click="abrir">SIM, ABRIR</button>
      <button class="fx-nao" @click="confirmar = false">Cancelar</button>
    </div>
    <div v-if="enviado" class="fx-vazio">Abrindo...</div>
    <div class="fx-topo">
      <div class="fx-item" :class="msg.payload.porta === 'Fechada' ? 'ok' : 'alerta'">
        <v-icon :icon="msg.payload.porta === 'Fechada' ? 'mdi-door-closed-lock' : 'mdi-door-open'" size="34"></v-icon>
        <span>Porta</span><b>{{ msg.payload.porta }}</b>
      </div>
      <div class="fx-item" :class="(msg.payload.bateria || 0) > 20 ? 'ok' : 'alerta'">
        <v-icon :icon="bateriaIcone" size="34"></v-icon>
        <span>Bateria</span><b>{{ msg.payload.bateria ? msg.payload.bateria + '%' : '—' }}</b>
      </div>
      <div class="fx-item" :class="msg.payload.travaInterna ? 'ok' : ''">
        <v-icon icon="mdi-shield-lock" size="34"></v-icon>
        <span>Trava interna</span><b>{{ msg.payload.travaInterna ? 'Ligada' : 'Desligada' }}</b>
      </div>
    </div>
    <div class="fx-hist-tit">Últimos eventos</div>
    <div v-if="!msg.payload.historico.length" class="fx-vazio">Nenhum evento ainda</div>
    <div v-for="(e, i) in msg.payload.historico" :key="i" class="fx-linha">
      <span class="fx-hora">{{ e.quando }}</span><span>{{ e.txt }}</span>
    </div>
  </div>
  <div v-else-if="!(msg && msg.payload && msg.payload.erro)" class="fx-vazio">Lendo a fechadura...</div>
</template>

<script>
export default {
  data() { return { confirmar: false, enviado: false } },
  watch: { msg() { this.enviado = false } },
  methods: {
    abrir() { this.confirmar = false; this.enviado = true; this.send({ topic: 'abrir', payload: true }); }
  },
  computed: {
    bateriaIcone() {
      const b = (this.msg && this.msg.payload && this.msg.payload.bateria) || 0;
      if (!b) return 'mdi-battery-unknown';
      return b > 80 ? 'mdi-battery' : b > 50 ? 'mdi-battery-70' : b > 20 ? 'mdi-battery-40' : 'mdi-battery-alert';
    }
  }
}
</script>

<style>
.fx { width: 100%; }
.fx-abrir { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; margin-bottom: 10px; border-radius: 12px;
  background: #1e6b34; color: #fff; font-weight: bold; font-size: 16px; cursor: pointer; user-select: none; }
.fx-abrir:active { filter: brightness(1.3); }
.fx-confirma { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px; margin-bottom: 10px; border-radius: 12px; background: rgba(255,152,0,.15); }
.fx-confirma span { flex: 1 1 100%; font-weight: bold; }
.fx-sim { flex: 1; padding: 10px; border-radius: 10px; background: #2e7d32; color: #fff; font-weight: bold; }
.fx-nao { flex: 1; padding: 10px; border-radius: 10px; background: rgba(255,255,255,.12); color: #fff; }
.fx-erro { color: #ff8a80; font-size: 13px; padding: 6px 0; }
.fx-topo { display: flex; gap: 8px; }
.fx-item { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 10px 4px; border-radius: 12px;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); }
.fx-item span { font-size: 12px; opacity: .7; margin-top: 4px; }
.fx-item b { font-size: 15px; }
.fx-item.ok { color: #4caf50; }
.fx-item.alerta { color: #ff9800; }
.fx-hist-tit { margin: 14px 0 6px; font-size: 13px; opacity: .7; }
.fx-linha { display: flex; gap: 10px; font-size: 13px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.fx-hora { opacity: .6; white-space: nowrap; }
.fx-vazio { opacity: .6; font-size: 13px; padding: 6px 0; }
</style>
