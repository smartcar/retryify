#!/usr/bin/env node
'use strict';

let buff = '';
process.stdin
  .on('data', (data) => {
    buff += data;
  })
  .on('end', () => {
    if (buff.length > 0) {
      buff.trim().split(/\r\n|\n/).forEach(processLine);
    }
  });

function processLine(line) {
  process.stdout.write(patchLine(line) + '\n');
}

function patchLine(line) {
  return line.replace(/\s+$/, '<br/>');
}
