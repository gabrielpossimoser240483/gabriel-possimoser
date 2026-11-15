<template>
  <div class="i3d">
    <div v-if="!p" class="i3d-vazio">Carregando histórico…</div>
    <div v-else-if="!p.suportado" class="i3d-vazio">{{ p.tipo === 'bambu' ? 'Na Bambu Lab o histórico fica na nuvem (Bambu Handy / Bambu Studio) e não é acessível pela rede local.' : 'O histórico de impressões está disponível só com Klipper/Moonraker.' }}</div>
    <template v-else>
      <div class="i3d-grade" style="margin-top:0">
        <div class="i3d-celula"><span>Impressões</span><b>{{ t.impressoes != null ? t.impressoes : '—' }}</b></div>
        <div class="i3d-celula"><span>Tempo imprimindo</span><b>{{ horas(t.tempoImpressao) }}</b></div>
        <div class="i3d-celula"><span>Filamento total</span><b>{{ t.filamento != null ? (t.filamento / 1000).toFixed(1) + ' m' : '—' }}</b></div>
        <div class="i3d-celula"><span>Maior impressão</span><b>{{ horas(t.maiorImpressao) }}</b></div>
        <div class="i3d-celula"><span>Taxa de sucesso*</span><b>{{ taxa }}</b></div>
      </div>
      <div class="i3d-sub" style="margin:6px 0 10px">* nas últimas {{ jobs.length }} impressões</div>

      <div class="i3d-rolagem">
        <table class="i3d-tabela">
          <thead><tr><th>Arquivo</th><th>Resultado</th><th>Início</th><th>Duração</th><th>Filamento</th><th></th></tr></thead>
          <tbody>
            <tr v-for="j in jobs" :key="j.id">
              <td><div class="i3d-elipse" :title="j.arquivo">{{ j.nome }}</div></td>
              <td><v-chip size="x-small" :color="cores[j.status] || 'grey'" variant="flat">{{ nomes[j.status] || j.status }}</v-chip></td>
              <td class="i3d-num" style="white-space:nowrap">{{ data(j.inicio) }}</td>
              <td class="i3d-num" style="white-space:nowrap">{{ dur(j.duracao) }}</td>
              <td class="i3d-num" style="white-space:nowrap">{{ j.filamento != null ? (j.filamento / 1000).toFixed(2) + ' m' : '—' }}</td>
              <td><v-btn v-if="j.existe" size="x-small" variant="text" icon="mdi-replay" title="Imprimir de novo" @click="repetir = j"></v-btn></td>
            </tr>
            <tr v-if="!jobs.length"><td colspan="6" class="i3d-vazio">Nenhuma impressão registrada.</td></tr>
          </tbody>
        </table>
      </div>

      <div v-if="repetir" class="i3d-confirma" style="border-color: rgba(var(--v-theme-primary), .5); background: rgba(var(--v-theme-primary), .06)">
        <div style="margin-bottom:8px">Imprimir de novo <b>{{ repetir.nome }}</b>?</div>
        <div class="i3d-linha">
          <v-btn color="primary" variant="flat" size="small" @click="imprimir">Imprimir</v-btn>
          <v-btn variant="text" size="small" @click="repetir = null">Voltar</v-btn>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  data() {
    return {
      repetir: null,
      cores: { completed: 'success', cancelled: 'grey', error: 'error', klippy_shutdown: 'error', klippy_disconnect: 'error', interrupted: 'warning', server_exit: 'warning', in_progress: 'primary' },
      nomes: { completed: 'Concluída', cancelled: 'Cancelada', error: 'Erro', klippy_shutdown: 'Desligou', klippy_disconnect: 'Desconectou', interrupted: 'Interrompida', server_exit: 'Interrompida', in_progress: 'Imprimindo' }
    }
  },
  computed: {
    p() { return this.msg && this.msg.payload },
    t() { return (this.p && this.p.totais) || {} },
    jobs() { return (this.p && this.p.jobs) || [] },
    taxa() {
      const fim = this.jobs.filter(j => j.status !== 'in_progress')
      if (!fim.length) return '—'
      return Math.round(100 * fim.filter(j => j.status === 'completed').length / fim.length) + '%'
    }
  },
  methods: {
    imprimir() { this.send({ topic: 'comando', payload: { acao: 'imprimir', arquivo: this.repetir.arquivo } }); this.repetir = null },
    horas(s) { if (s == null) return '—'; const h = s / 3600; return h >= 1 ? h.toFixed(h >= 100 ? 0 : 1) + ' h' : Math.round(s / 60) + ' min' },
    dur(s) { if (s == null) return '—'; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? h + 'h' + String(m).padStart(2, '0') : m + 'min' },
    data(t) { return t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' }
  }
}
</script>
