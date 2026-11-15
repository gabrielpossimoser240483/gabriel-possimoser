<template>
  <div class="i3d">
    <div v-if="!e" class="i3d-vazio">Aguardando dados…</div>
    <template v-else>
      <div class="i3d-linha">
        <v-btn v-if="e.estado === 'imprimindo' || e.estado === 'preparando'" color="warning" variant="flat" prepend-icon="mdi-pause" @click="enviar('pausar')">Pausar</v-btn>
        <v-btn v-if="['pausada','pausando'].includes(e.estado)" color="primary" variant="flat" prepend-icon="mdi-play" @click="enviar('retomar')">Retomar</v-btn>
        <v-btn v-if="ativa" color="error" variant="tonal" prepend-icon="mdi-stop" @click="pedir('cancelar')">Cancelar</v-btn>
        <span v-if="!ativa" class="i3d-sub">Nenhuma impressão em andamento.</span>
      </div>

      <div class="i3d-titulo">Máquina</div>
      <div class="i3d-linha">
        <v-btn size="small" variant="tonal" prepend-icon="mdi-engine-off-outline" :disabled="e.estado === 'imprimindo' || travado" @click="pedir('desligarMotores')">Desligar motores</v-btn>
        <v-btn size="small" variant="tonal" prepend-icon="mdi-snowflake" :disabled="travado" @click="enviar('desligarAquecimento')">Desligar aquecimento</v-btn>
        <v-btn v-if="e.tipo === 'bambu'" size="small" variant="tonal" prepend-icon="mdi-restart" @click="enviar('reiniciarFirmware')">Reconectar</v-btn>
        <v-btn v-else size="small" variant="tonal" prepend-icon="mdi-restart" :disabled="['offline','conectando','semconfig'].includes(e.estado)" @click="pedir('reiniciarFirmware')">{{ e.tipo === 'octoprint' ? 'Reconectar' : 'Reiniciar firmware' }}</v-btn>
        <v-btn v-if="e.tipo === 'bambu'" size="small" :variant="e.luz ? 'flat' : 'tonal'" :color="e.luz ? 'amber' : undefined" :prepend-icon="e.luz ? 'mdi-lightbulb-on' : 'mdi-lightbulb-outline'" :disabled="travado" @click="send({ topic: 'comando', payload: { acao: 'luz', ligar: !e.luz } })">Luz {{ e.luz ? 'ligada' : 'desligada' }}</v-btn>
      </div>
      <div class="i3d-linha" style="margin-top:12px">
        <v-btn block color="error" variant="flat" prepend-icon="mdi-alert-octagon" :disabled="travado" @click="pedir('emergencia')">{{ e.tipo === 'bambu' ? 'Parar tudo agora' : 'Parada de emergência' }}</v-btn>
      </div>

      <div v-if="confirmar" class="i3d-confirma">
        <div style="margin-bottom:8px"><b>{{ textos[confirmar].titulo }}</b><br><span class="i3d-sub">{{ textos[confirmar].texto }}</span></div>
        <div class="i3d-linha">
          <v-btn color="error" variant="flat" size="small" @click="enviar(confirmar); confirmar = null">Sim, {{ textos[confirmar].verbo }}</v-btn>
          <v-btn variant="text" size="small" @click="confirmar = null">Voltar</v-btn>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  data() {
    return {
      confirmar: null,
      textos: {
        cancelar: { titulo: 'Cancelar a impressão?', texto: 'A peça atual será perdida.', verbo: 'cancelar' },
        emergencia: { titulo: 'Parada de emergência?', texto: 'Interrompe a impressão e desliga os aquecedores na hora.', verbo: 'parar agora' },
        reiniciarFirmware: { titulo: 'Reiniciar / reconectar?', texto: 'A conexão com a placa da impressora será refeita.', verbo: 'reiniciar' },
        desligarMotores: { titulo: 'Desligar os motores?', texto: 'Os eixos perdem a referência (home) e ficam soltos.', verbo: 'desligar' }
      }
    }
  },
  computed: {
    e() { return this.msg && this.msg.payload && this.msg.payload.cfg ? this.msg.payload : null },
    ativa() { return ['imprimindo', 'preparando', 'pausada', 'pausando'].includes(this.e.estado) },
    travado() { return ['offline', 'conectando', 'semconfig', 'desconectada'].includes(this.e.estado) }
  },
  methods: {
    pedir(acao) { this.confirmar = acao },
    enviar(acao) { this.send({ topic: 'comando', payload: { acao } }) }
  }
}
</script>
