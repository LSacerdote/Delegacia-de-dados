
import { readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, 'assets', 'audio');
const MANIFESTO = join(AQUI, 'narracao.json');

const args = process.argv.slice(2);
const temFlag = f => args.includes(f);
const valor = (f, padrao) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : padrao; };

const c = (n, t) => `[${n}m${t}[0m`;
const ok = t => c(32, t), erro = t => c(31, t), fraco = t => c(90, t), forte = t => c(33, t), azul = t => c(36, t);

const USAR_ELEVEN = temFlag('--elevenlabs');
const VOZ = valor('--voz', USAR_ELEVEN
  ? (process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb')
  : 'pt-BR-AntonioNeural');
/* o edge-tts exige sinal explícito: "-8%" ou "+8%", "-12Hz" ou "+12Hz" */
const sinal = (v, unidade) => {
  const t = String(v).trim();
  const comSinal = /^[+-]/.test(t) ? t : '+' + t;
  return /[a-z%]$/i.test(comSinal) ? comSinal : comSinal + unidade;
};
const RITMO = sinal(valor('--ritmo', '-8%'), '%');    // mais devagar: tom de narrador
const TOM = sinal(valor('--tom', '-12Hz'), 'Hz');     // mais grave

/* ---------------- edge-tts ---------------- */
function rodar(cmd, argumentos) {
  return new Promise(resolve => {
    const p = spawn(cmd, argumentos, { stdio: ['ignore', 'pipe', 'pipe'] });
    let saida = '', falha = '';
    p.stdout.on('data', d => { saida += d; });
    p.stderr.on('data', d => { falha += d; });
    p.on('error', e => resolve({ codigo: -1, saida, falha: e.message }));
    p.on('close', codigo => resolve({ codigo, saida, falha }));
  });
}

let EDGE = null;
async function acharEdge() {
  for (const tentativa of [['edge-tts', ['--version']], ['python3', ['-m', 'edge_tts', '--version']], ['python', ['-m', 'edge_tts', '--version']]]) {
    const r = await rodar(tentativa[0], tentativa[1]);
    if (r.codigo === 0 || /edge/i.test(r.saida + r.falha)) {
      EDGE = { cmd: tentativa[0], base: tentativa[1].slice(0, -1) };
      return true;
    }
  }
  return false;
}

async function gerarEdge(fala, destino) {
  // valores negativos precisam ir colados com "=", senão o edge-tts
  // acha que "-8%" é outra opção e recusa
  const r = await rodar(EDGE.cmd, EDGE.base.concat([
    '--voice', VOZ, '--rate=' + RITMO, '--pitch=' + TOM,
    '--text', fala.texto, '--write-media', destino
  ]));
  if (r.codigo !== 0) {
    const bruto = (r.falha || r.saida || 'falhou').trim();
    if (/WSServerHandshake|ClientConnector|ConnectionRefused|getaddrinfo|Timeout/i.test(bruto)) {
      throw new Error('REDE: não consegui falar com o serviço de voz da Microsoft — sem internet, ou um proxy/firewall no caminho.');
    }
    if (/No such voice|voice.*not found/i.test(bruto)) {
      throw new Error('Voz "' + VOZ + '" não existe. Rode --listar para ver os nomes válidos.');
    }
    throw new Error(bruto.split('\n').pop());
  }
  const s = await stat(destino).catch(() => null);
  if (!s || s.size < 1000) {
    await rm(destino, { force: true });   // não deixa arquivo vazio para trás
    throw new Error('o serviço devolveu áudio vazio — confira o nome da voz com --listar');
  }
  return Math.round(s.size / 1024) + ' KB';
}

async function listarEdge() {
  const r = await rodar(EDGE.cmd, EDGE.base.concat(['--list-voices']));
  const linhas = r.saida.split('\n').filter(l => /^pt-/.test(l.trim()));
  console.log('\n' + forte('Vozes em português') + fraco('  (use o nome com --voz)\n'));
  linhas.forEach(l => {
    const nome = l.trim().split(/\s+/)[0];
    console.log('  ' + azul(nome.padEnd(34)) + fraco(l.trim().slice(nome.length).trim()));
  });
  console.log('\n' + fraco('Sugestões: pt-BR-AntonioNeural (grave, masculina) · pt-BR-FranciscaNeural (calorosa)\n' +
    '           pt-BR-ThalitaMultilingualNeural (a mais natural das novas)\n'));
}

/* ---------------- ElevenLabs (opcional) ---------------- */
async function gerarEleven(fala, destino) {
  const chave = process.env.ELEVENLABS_API_KEY;
  const modelo = temFlag('--flash') ? 'eleven_flash_v2_5'
    : valor('--modelo', process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2');
  for (let t = 1; t <= 4; t++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': chave, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: fala.texto, model_id: modelo,
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true }
      })
    });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      await writeFile(destino, buf);
      return Math.round(buf.length / 1024) + ' KB';
    }
    if (r.status === 429 || r.status >= 500) {
      console.log(fraco(`    limite de taxa (${r.status}), esperando ${t * 4}s...`));
      await new Promise(s => setTimeout(s, t * 4000));
      continue;
    }
    throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 240)}`);
  }
  throw new Error('não deu certo depois de 4 tentativas');
}

/* ---------------- principal ---------------- */
async function existe(caminho) {
  try { return (await stat(caminho)).size > 1000; } catch { return false; }
}

async function principal() {
  if (USAR_ELEVEN && !process.env.ELEVENLABS_API_KEY) {
    console.error(erro('Falta a chave.') + ' Defina ELEVENLABS_API_KEY ou rode sem --elevenlabs para usar o edge-tts (grátis).');
    process.exit(1);
  }

  if (!USAR_ELEVEN && !(await acharEdge())) {
    console.error('\n' + erro('Não encontrei o edge-tts.') + '  Ele é grátis e não pede conta nem chave:\n\n' +
      '    ' + azul('pip install edge-tts') + '\n\n' +
      fraco('  Se o pip reclamar de ambiente gerenciado, use:\n' +
            '    pip install --user edge-tts\n' +
            '    ou  pipx install edge-tts\n'));
    process.exit(1);
  }

  if (temFlag('--listar')) {
    if (USAR_ELEVEN) {
      const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
      if (!r.ok) {
        console.error(erro('\nHTTP ' + r.status) + ' — ' + (r.status === 401 ? 'chave recusada.' : (await r.text()).slice(0, 200)) + '\n');
        process.exit(1);
      }
      const { voices = [] } = await r.json();
      const salvas = voices.filter(v => v.category !== 'premade');
      const prontas = voices.filter(v => v.category === 'premade');
      const linha = v => {
        const l = v.labels || {};
        const etiquetas = [l.gender, l.accent, l.age, l.description].filter(Boolean).join(', ');
        const fem = /female|feminin/i.test(l.gender || '');
        return '  ' + azul(v.voice_id) + '  ' + (fem ? forte('♀') : fraco('♂')) + ' ' +
          v.name.padEnd(22) + fraco(etiquetas);
      };
      if (salvas.length) {
        console.log('\n' + forte('Suas vozes salvas') + fraco('  (' + salvas.length + ')'));
        salvas.forEach(v => console.log(linha(v)));
      }
      if (prontas.length) {
        console.log('\n' + forte('Vozes prontas do ElevenLabs') + fraco('  (' + prontas.length + ')'));
        prontas.forEach(v => console.log(linha(v)));
      }
      console.log('\n' + fraco('  ♀ feminina   ♂ masculina ou sem rótulo') +
        '\n' + fraco('  Copie o id e rode:  node narrar.mjs --elevenlabs --voz <id> --limite 2\n'));
      return;
    }
    return listarEdge();
  }

  let falas;
  try { falas = JSON.parse(await readFile(MANIFESTO, 'utf8')); }
  catch { console.error(erro('Não achei narracao.json ao lado deste script.')); process.exit(1); }
  if (!temFlag('--pistas')) falas = falas.filter(f => f.grupo !== 'pista');

  // --limite N: grava só as N primeiras. Serve para ouvir a voz antes
  // de gastar a cota inteira, já que o script pula o que já existe.
  const limite = parseInt(valor('--limite', '0'), 10);
  if (limite > 0) falas = falas.slice(0, limite);

  await mkdir(SAIDA, { recursive: true });
  const total = falas.reduce((s, f) => s + f.texto.length, 0);

  console.log('\n' + forte('Delegacia de Dados · narração'));
  console.log(fraco('  motor  ') + (USAR_ELEVEN
    ? 'ElevenLabs ' + fraco('(' + (temFlag('--flash') ? 'flash v2.5, meio crédito por caractere' : 'multilingual v2, 1 crédito por caractere') + ')')
    : 'edge-tts ' + fraco('(grátis, sem cota)')));
  console.log(fraco('  voz    ') + VOZ + (USAR_ELEVEN ? '' : fraco('   ritmo ' + RITMO + '  tom ' + TOM)));
  console.log(fraco('  falas  ') + falas.length + fraco('  ·  ') + total.toLocaleString('pt-BR') + fraco(' caracteres'));
  if (USAR_ELEVEN) {
    const creditos = temFlag('--flash') ? Math.ceil(total / 2) : total;
    const folga = 10000 - creditos;
    console.log(fraco('  cota   ') + '~' + creditos.toLocaleString('pt-BR') + ' créditos' +
      (folga >= 0 ? fraco('  ·  sobram ~' + folga.toLocaleString('pt-BR') + ' dos 10.000 do plano grátis')
                  : erro('  ·  passa ' + Math.abs(folga).toLocaleString('pt-BR') + ' do plano grátis')));
  }
  console.log('');

  let feitos = 0, pulados = 0, falhas = 0, seguidas = 0;
  for (const [i, fala] of falas.entries()) {
    const n = String(i + 1).padStart(String(falas.length).length, ' ');
    process.stdout.write(`  ${fraco(n + '/' + falas.length)}  ${fala.arquivo.padEnd(24)} `);
    const destino = join(SAIDA, fala.arquivo + '.mp3');
    if (!temFlag('--forcar') && await existe(destino)) { pulados++; console.log(fraco('já existe')); continue; }
    try {
      console.log(ok(USAR_ELEVEN ? await gerarEleven(fala, destino) : await gerarEdge(fala, destino)));
      feitos++; seguidas = 0;
      await new Promise(s => setTimeout(s, USAR_ELEVEN ? 350 : 120));
    } catch (e) {
      falhas++; seguidas++;
      console.log(erro('falhou'));
      console.error('    ' + e.message);
      if (/401|invalid_api_key/.test(e.message)) { console.error(erro('\n  Chave recusada.\n')); process.exit(1); }
      if (/não existe|not found/i.test(e.message)) process.exit(1);
      if (seguidas >= 3) {
        console.error(erro('\n  Três falhas seguidas — parei aqui para não repetir o mesmo erro 20 vezes.'));
        console.error(fraco('  Resolva o que está acima e rode de novo: o que já foi gravado será pulado.\n'));
        process.exit(1);
      }
    }
  }

  console.log('\n  ' + ok(feitos + ' gerados') + fraco('  ·  ') + pulados + fraco(' já existiam') +
    (falhas ? fraco('  ·  ') + erro(falhas + ' falharam') : ''));
  console.log(fraco('  Os arquivos estão em assets/audio/. Publique de novo e o jogo passa a usá-los.\n'));
}

principal().catch(e => { console.error(erro('\n' + e.message + '\n')); process.exit(1); });
