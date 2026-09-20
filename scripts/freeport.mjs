// gy-3hyzh — print a TCP port that is free on 127.0.0.1 at this instant.
// The one implementation of the freeport idiom (gy-cjdtw) that workflows used
// to inline four times. It is only free "at this instant": the port is released
// before it is used, so call it as late as possible — scripts/pw-test.sh does.
import { createServer } from 'node:net';

const s = createServer();
s.listen(0, '127.0.0.1', () => {
  process.stdout.write(String(s.address().port));
  s.close();
});
