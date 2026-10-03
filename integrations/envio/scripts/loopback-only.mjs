// Envio 3.12.1 ignores ENVIO_INDEXER_HOST. Restrict only its child process's
// TCP listeners; outbound public RPC clients and Unix sockets are unchanged.
import { Server } from 'node:net';
const listen = Server.prototype.listen;
Server.prototype.listen = function (...args) {
  if (typeof args[0] === 'object' && args[0] !== null && 'port' in args[0]) {
    args[0] = { ...args[0], host: '127.0.0.1' };
  } else if (typeof args[0] === 'number' || (typeof args[0] === 'string' && /^\d+$/.test(args[0]))) {
    if (typeof args[1] === 'string') args[1] = '127.0.0.1';
    else args.splice(1, 0, '127.0.0.1');
  }
  return Reflect.apply(listen, this, args);
};
