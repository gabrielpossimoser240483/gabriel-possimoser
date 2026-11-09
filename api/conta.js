// Chamado pelo app logo após o login: registra o dono (primeira conta) e informa se
// esta conta pode usar a IA.
import { rota, exigirUsuario, ErroHttp } from "./_lib.js";

export default rota(async (req) => {
  try {
    await exigirUsuario(req);
    return { ia: true };
  } catch (e) {
    if (e instanceof ErroHttp && e.status === 403) return { ia: false, motivo: e.message };
    throw e;
  }
});
