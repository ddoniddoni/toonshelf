import "server-only";

const crcTable=Array.from({length:256},(_,n)=>{
  let c=n;for(let i=0;i<8;i++) c=(c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;return c >>> 0;
});
export function pngCrc32(data:Uint8Array) {
  let c=0xffffffff;for(const byte of data) c=crcTable[(c ^ byte) & 255]! ^ (c >>> 8);return (c ^ 0xffffffff) >>> 0;
}
// Small, bounded, uncompressed ZIP. PNG is already compressed; no ZIP64, paths,
// user-provided filenames, temporary files, or additional archive dependency.
export function zipTierPngs(files:Buffer[]) {
  if (files.length < 2 || files.length > 8 || files.reduce((n,f)=>n+f.length,0) > 16*1024*1024)
    throw new Error("Image archive limit");
  const locals:Buffer[]=[],central:Buffer[]=[];let offset=0;
  for(const [i,file] of files.entries()) {
    const name=Buffer.from(`toonshelf-page-${String(i+1).padStart(2,"0")}.png`),crc=pngCrc32(file);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
    local.writeUInt16LE(0x21,12); // DOS date 1980-01-01, no identifying timestamp.
    local.writeUInt32LE(crc,14);local.writeUInt32LE(file.length,18);local.writeUInt32LE(file.length,22);local.writeUInt16LE(name.length,26);
    locals.push(local,name,file);
    const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50,0);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);
    entry.writeUInt16LE(0x21,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(file.length,20);entry.writeUInt32LE(file.length,24);
    entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);central.push(entry,name);offset+=local.length+name.length+file.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}
