export function selectRuntime(args: string[]) {
  let recent = false, window: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--recent' && !recent) recent = true;
    else if (args[i] === '--window' && window === undefined) {
      window = args[++i];
      if (!window || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(window)) throw new Error('Window must be a short lowercase alphanumeric tag with optional hyphens');
    } else throw new Error('Unsupported or duplicate runtime argument');
  }
  if (window && !recent) throw new Error('--window requires --recent');
  return { recent, runtime: recent ? `.runtime/recent${window ? '-' + window : ''}` : '.runtime',
    schema: recent ? `mandate_envio_recent${window ? '_' + window.replaceAll('-', '_') : ''}` : 'mandate_envio' };
}
