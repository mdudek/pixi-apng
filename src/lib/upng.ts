import * as pako from 'pako'

if (Uint8Array && !Uint8Array.prototype.slice) {
    Uint8Array.prototype.slice = function (...arg) {
        return new Uint8Array(this).subarray(...arg);
    };
}

export function uPng(out) {
    let w = out.width,
        h = out.height;
    if (out.tabs.acTL == null) return [toRGBA8.decodeImage(out.data, w, h, out).buffer];

    let frms = [];
    if (out.frames[0].data == null) out.frames[0].data = out.data;

    let img, empty = new Uint8Array(w * h * 4);
    for (let i = 0; i < out.frames.length; i++) {
        let frm = out.frames[i];
        let fx = frm.rect.x,
            fy = frm.rect.y,
            fw = frm.rect.width,
            fh = frm.rect.height;
        let fdata = toRGBA8.decodeImage(frm.data, fw, fh, out);

        if (i == 0) img = fdata;
        else if (frm.blend == 0) _copyTile(fdata, fw, fh, img, w, h, fx, fy, 0);
        else if (frm.blend == 1) _copyTile(fdata, fw, fh, img, w, h, fx, fy, 1);

        frms.push(img.buffer);
        img = img.slice(0);

        if (frm.dispose == 0) {
        } else if (frm.dispose == 1) _copyTile(empty, fw, fh, img, w, h, fx, fy, 0);
        else if (frm.dispose == 2) {
            let pi = i - 1;
            while (out.frames[pi].dispose == 2) pi--;
            img = new Uint8Array(frms[pi]).slice(0);
        }
    }
    return frms;
}

class toRGBA8 {
    static decodeImage(data, w, h, out) {
        let area = w * h,
            bpp = decode._getBPP(out);
        let bpl = Math.ceil(w * bpp / 8); // bytes per line
        let bf = new Uint8Array(area * 4),
            bf32 = new Uint32Array(bf.buffer);
        let ctype = out.ctype,
            depth = out.depth;
        let rs = _bin.readUshort;

        //console.log(ctype, depth);
        if (ctype == 6) { // RGB + alpha
            let qarea = area << 2;
            if (depth == 8)
                for (let i = 0; i < qarea; i++) {
                    bf[i] = data[i];
                    /*if((i&3)==3 && data[i]!=0) bf[i]=255;*/
                }
            if (depth == 16)
                for (let i = 0; i < qarea; i++) {
                    bf[i] = data[i << 1];
                }
        } else if (ctype == 2) { // RGB
            let ts = out.tabs["tRNS"],
                tr = -1,
                tg = -1,
                tb = -1;
            if (ts) {
                tr = ts[0];
                tg = ts[1];
                tb = ts[2];
            }
            if (depth == 8)
                for (let i = 0; i < area; i++) {
                    let qi = i << 2,
                        ti = i * 3;
                    bf[qi] = data[ti];
                    bf[qi + 1] = data[ti + 1];
                    bf[qi + 2] = data[ti + 2];
                    bf[qi + 3] = 255;
                    if (tr != -1 && data[ti] == tr && data[ti + 1] == tg && data[ti + 2] == tb) bf[qi + 3] = 0;
                }
            if (depth == 16)
                for (let i = 0; i < area; i++) {
                    let qi = i << 2,
                        ti = i * 6;
                    bf[qi] = data[ti];
                    bf[qi + 1] = data[ti + 2];
                    bf[qi + 2] = data[ti + 4];
                    bf[qi + 3] = 255;
                    if (tr != -1 && rs(data, ti) == tr && rs(data, ti + 2) == tg && rs(data, ti + 4) == tb) bf[qi + 3] = 0;
                }
        } else if (ctype == 3) { // palette
            let p = out.tabs["PLTE"],
                ap = out.tabs["tRNS"],
                tl = ap ? ap.length : 0;
            //console.log(p, ap);
            if (depth == 1)
                for (let y = 0; y < h; y++) {
                    let s0 = y * bpl,
                        t0 = y * w;
                    for (let i = 0; i < w; i++) {
                        let qi = (t0 + i) << 2,
                            j = ((data[s0 + (i >> 3)] >> (7 - ((i & 7) << 0))) & 1),
                            cj = 3 * j;
                        bf[qi] = p[cj];
                        bf[qi + 1] = p[cj + 1];
                        bf[qi + 2] = p[cj + 2];
                        bf[qi + 3] = (j < tl) ? ap[j] : 255;
                    }
                }
            if (depth == 2)
                for (let y = 0; y < h; y++) {
                    let s0 = y * bpl,
                        t0 = y * w;
                    for (let i = 0; i < w; i++) {
                        let qi = (t0 + i) << 2,
                            j = ((data[s0 + (i >> 2)] >> (6 - ((i & 3) << 1))) & 3),
                            cj = 3 * j;
                        bf[qi] = p[cj];
                        bf[qi + 1] = p[cj + 1];
                        bf[qi + 2] = p[cj + 2];
                        bf[qi + 3] = (j < tl) ? ap[j] : 255;
                    }
                }
            if (depth == 4)
                for (let y = 0; y < h; y++) {
                    let s0 = y * bpl,
                        t0 = y * w;
                    for (let i = 0; i < w; i++) {
                        let qi = (t0 + i) << 2,
                            j = ((data[s0 + (i >> 1)] >> (4 - ((i & 1) << 2))) & 15),
                            cj = 3 * j;
                        bf[qi] = p[cj];
                        bf[qi + 1] = p[cj + 1];
                        bf[qi + 2] = p[cj + 2];
                        bf[qi + 3] = (j < tl) ? ap[j] : 255;
                    }
                }
            if (depth == 8)
                for (let i = 0; i < area; i++) {
                    let qi = i << 2,
                        j = data[i],
                        cj = 3 * j;
                    bf[qi] = p[cj];
                    bf[qi + 1] = p[cj + 1];
                    bf[qi + 2] = p[cj + 2];
                    bf[qi + 3] = (j < tl) ? ap[j] : 255;
                }
        } else if (ctype == 4) { // gray + alpha
            if (depth == 8)
                for (let i = 0; i < area; i++) {
                    let qi = i << 2,
                        di = i << 1,
                        gr = data[di];
                    bf[qi] = gr;
                    bf[qi + 1] = gr;
                    bf[qi + 2] = gr;
                    bf[qi + 3] = data[di + 1];
                }
            if (depth == 16)
                for (let i = 0; i < area; i++) {
                    let qi = i << 2,
                        di = i << 2,
                        gr = data[di];
                    bf[qi] = gr;
                    bf[qi + 1] = gr;
                    bf[qi + 2] = gr;
                    bf[qi + 3] = data[di + 2];
                }
        } else if (ctype == 0) { // gray
            let tr = out.tabs["tRNS"] ? out.tabs["tRNS"] : -1;
            if (depth == 1)
                for (let i = 0; i < area; i++) {
                    let gr = 255 * ((data[i >> 3] >> (7 - ((i & 7)))) & 1),
                        al = (gr == tr * 255) ? 0 : 255;
                    bf32[i] = (al << 24) | (gr << 16) | (gr << 8) | gr;
                }
            if (depth == 2)
                for (let i = 0; i < area; i++) {
                    let gr = 85 * ((data[i >> 2] >> (6 - ((i & 3) << 1))) & 3),
                        al = (gr == tr * 85) ? 0 : 255;
                    bf32[i] = (al << 24) | (gr << 16) | (gr << 8) | gr;
                }
            if (depth == 4)
                for (let i = 0; i < area; i++) {
                    let gr = 17 * ((data[i >> 1] >> (4 - ((i & 1) << 2))) & 15),
                        al = (gr == tr * 17) ? 0 : 255;
                    bf32[i] = (al << 24) | (gr << 16) | (gr << 8) | gr;
                }
            if (depth == 8)
                for (let i = 0; i < area; i++) {
                    let gr = data[i],
                        al = (gr == tr) ? 0 : 255;
                    bf32[i] = (al << 24) | (gr << 16) | (gr << 8) | gr;
                }
            if (depth == 16)
                for (let i = 0; i < area; i++) {
                    let gr = data[i << 1],
                        al = (rs(data, i << 1) == tr) ? 0 : 255;
                    bf32[i] = (al << 24) | (gr << 16) | (gr << 8) | gr;
                }
        }
        return bf;
    }
}

export function decodeBuffer(buff) {
    let data = new Uint8Array(buff),
        offset = 8,
        bin = _bin,
        rUs = bin.readUshort,
        rUi = bin.readUint;
    let out = {
        tabs: {},
        frames: [],
        ctype: null,
        data: null,
        width: null,
        height: null,
        compress: null,
        interlace: null,
        filter: null
    };
    let dd = new Uint8Array(data.length),
        doff = 0; // put all IDAT data into it
    let fd: Uint8Array, foff = 0; // frames
    let mgck = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++)
        if (data[i] != mgck[i]) throw "The input is not a PNG file!";

    while (offset < data.length) {
        let len = bin.readUint(data, offset);
        offset += 4;
        let type = bin.readASCII(data, offset, 4);
        offset += 4;
        //console.log(type,len);
        if (type == "IHDR") {
            decode._IHDR(data, offset, out);
        } else if (type == "IDAT") {
            for (let i = 0; i < len; i++) dd[doff + i] = data[offset + i];
            doff += len;
        } else if (type == "acTL") {
            out.tabs[type] = {
                num_frames: rUi(data, offset),
                num_plays: rUi(data, offset + 4)
            };
            fd = new Uint8Array(data.length);
        } else if (type == "fcTL") {
            if (foff != 0) {
                let fr = out.frames[out.frames.length - 1];
                fr.data = decode._decompress(out, fd.slice(0, foff), fr.rect.width, fr.rect.height);
                foff = 0;
            }
            let rct = {
                x: rUi(data, offset + 12),
                y: rUi(data, offset + 16),
                width: rUi(data, offset + 4),
                height: rUi(data, offset + 8)
            };
            let del = rUs(data, offset + 22);
            del = rUs(data, offset + 20) / (del == 0 ? 100 : del);
            let frm = {
                rect: rct,
                delay: Math.round(del * 1000),
                dispose: data[offset + 24],
                blend: data[offset + 25]
            };
            //console.log(frm);
            out.frames.push(frm);
        } else if (type == "fdAT") {
            for (let i = 0; i < len - 4; i++) fd[foff + i] = data[offset + i + 4];
            foff += len - 4;
        } else if (type == "pHYs") {
            out.tabs[type] = [bin.readUint(data, offset), bin.readUint(data, offset + 4), data[offset + 8]];
        } else if (type == "cHRM") {
            out.tabs[type] = [];
            for (let i = 0; i < 8; i++) out.tabs[type].push(bin.readUint(data, offset + i * 4));
        } else if (type == "tEXt") {
            if (out.tabs[type] == null) out.tabs[type] = {};
            let nz = bin.nextZero(data, offset);
            let keyw = bin.readASCII(data, offset, nz - offset);
            let text = bin.readASCII(data, nz + 1, offset + len - nz - 1);
            out.tabs[type][keyw] = text;
        } else if (type == "iTXt") {
            if (out.tabs[type] == null) out.tabs[type] = {};
            let nz = 0,
                off = offset;
            nz = bin.nextZero(data, off);
            let keyw = bin.readASCII(data, off, nz - off);
            off = nz + 1;
            let cflag = data[off],
                cmeth = data[off + 1];
            off += 2;
            nz = bin.nextZero(data, off);
            let ltag = bin.readASCII(data, off, nz - off);
            off = nz + 1;
            nz = bin.nextZero(data, off);
            let tkeyw = bin.readUTF8(data, off, nz - off);
            off = nz + 1;
            let text = bin.readUTF8(data, off, len - (off - offset));
            out.tabs[type][keyw] = text;
        } else if (type == "PLTE") {
            out.tabs[type] = bin.readBytes(data, offset, len);
        } else if (type == "hIST") {
            let pl = out.tabs["PLTE"].length / 3;
            out.tabs[type] = [];
            for (let i = 0; i < pl; i++) out.tabs[type].push(rUs(data, offset + i * 2));
        } else if (type == "tRNS") {
            if (out.ctype == 3) out.tabs[type] = bin.readBytes(data, offset, len);
            else if (out.ctype == 0) out.tabs[type] = rUs(data, offset);
            else if (out.ctype == 2) out.tabs[type] = [rUs(data, offset), rUs(data, offset + 2), rUs(data, offset + 4)];
            //else console.log("tRNS for unsupported color type",out.ctype, len);
        } else if (type == "gAMA") out.tabs[type] = bin.readUint(data, offset) / 100000;
        else if (type == "sRGB") out.tabs[type] = data[offset];
        else if (type == "bKGD") {
            if (out.ctype == 0 || out.ctype == 4) out.tabs[type] = [rUs(data, offset)];
            else if (out.ctype == 2 || out.ctype == 6) out.tabs[type] = [rUs(data, offset), rUs(data, offset + 2), rUs(data, offset + 4)];
            else if (out.ctype == 3) out.tabs[type] = data[offset];
        } else if (type == "IEND") {
            break;
        }
        offset += len;
        let crc = bin.readUint(data, offset);
        offset += 4;
    }
    if (foff != 0) {
        let fr = out.frames[out.frames.length - 1];
        fr.data = decode._decompress(out, fd.slice(0, foff), fr.rect.width, fr.rect.height);
        foff = 0;
    }
    out.data = decode._decompress(out, dd, out.width, out.height);

    delete out.compress;
    delete out.interlace;
    delete out.filter;
    return out;
}

class decode {

    static _decompress(out, dd, w, h) {
        if (out.compress == 0) dd = decode._inflate(dd);

        if (out.interlace == 0) dd = decode._filterZero(dd, out, 0, w, h);
        else if (out.interlace == 1) dd = decode._readInterlace(dd, out);
        return dd;
    }

    static _inflate(data) {
        return pako["inflate"](data);
    }

    static _readInterlace(data, out) {
        let w = out.width,
            h = out.height;
        let bpp = decode._getBPP(out),
            cbpp = bpp >> 3,
            bpl = Math.ceil(w * bpp / 8);
        let img = new Uint8Array(h * bpl);
        let di = 0;

        let starting_row = [0, 0, 4, 0, 2, 0, 1];
        let starting_col = [0, 4, 0, 2, 0, 1, 0];
        let row_increment = [8, 8, 8, 4, 4, 2, 2];
        let col_increment = [8, 8, 4, 4, 2, 2, 1];

        let pass = 0;
        while (pass < 7) {
            let ri = row_increment[pass],
                ci = col_increment[pass];
            let sw = 0,
                sh = 0;
            let cr = starting_row[pass];
            while (cr < h) {
                cr += ri;
                sh++;
            }
            let cc = starting_col[pass];
            while (cc < w) {
                cc += ci;
                sw++;
            }
            let bpll = Math.ceil(sw * bpp / 8);
            decode._filterZero(data, out, di, sw, sh);

            let y = 0,
                row = starting_row[pass];
            while (row < h) {
                let col = starting_col[pass];
                let cdi = (di + y * bpll) << 3;

                while (col < w) {
                    if (bpp == 1) {
                        let val = data[cdi >> 3];
                        val = (val >> (7 - (cdi & 7))) & 1;
                        img[row * bpl + (col >> 3)] |= (val << (7 - ((col & 3) << 0)));
                    }
                    if (bpp == 2) {
                        let val = data[cdi >> 3];
                        val = (val >> (6 - (cdi & 7))) & 3;
                        img[row * bpl + (col >> 2)] |= (val << (6 - ((col & 3) << 1)));
                    }
                    if (bpp == 4) {
                        let val = data[cdi >> 3];
                        val = (val >> (4 - (cdi & 7))) & 15;
                        img[row * bpl + (col >> 1)] |= (val << (4 - ((col & 1) << 2)));
                    }
                    if (bpp >= 8) {
                        let ii = row * bpl + col * cbpp;
                        for (let j = 0; j < cbpp; j++) img[ii + j] = data[(cdi >> 3) + j];
                    }
                    cdi += bpp;
                    col += ci;
                }
                y++;
                row += ri;
            }
            if (sw * sh != 0) di += sh * (1 + bpll);
            pass = pass + 1;
        }
        return img;
    }

    static _getBPP(out) {
        let noc = [1, null, 3, 1, 2, null, 4][out.ctype];
        return noc * out.depth;
    }

    static _filterZero(data, out, off, w, h) {
        let bpp = decode._getBPP(out),
            bpl = Math.ceil(w * bpp / 8),
            paeth = decode._paeth;
        bpp = Math.ceil(bpp / 8);

        for (let y = 0; y < h; y++) {
            let i = off + y * bpl,
                di = i + y + 1;
            let type = data[di - 1];

            if (type == 0)
                for (let x = 0; x < bpl; x++) data[i + x] = data[di + x];
            else if (type == 1) {
                for (let x = 0; x < bpp; x++) data[i + x] = data[di + x];
                for (let x = bpp; x < bpl; x++) data[i + x] = (data[di + x] + data[i + x - bpp]) & 255;
            } else if (y == 0) {
                for (let x = 0; x < bpp; x++) data[i + x] = data[di + x];
                if (type == 2)
                    for (let x = bpp; x < bpl; x++) data[i + x] = (data[di + x]) & 255;
                if (type == 3)
                    for (let x = bpp; x < bpl; x++) data[i + x] = (data[di + x] + (data[i + x - bpp] >> 1)) & 255;
                if (type == 4)
                    for (let x = bpp; x < bpl; x++) data[i + x] = (data[di + x] + paeth(data[i + x - bpp], 0, 0)) & 255;
            } else {
                if (type == 2) {
                    for (let x = 0; x < bpl; x++) data[i + x] = (data[di + x] + data[i + x - bpl]) & 255;
                }

                if (type == 3) {
                    for (let x = 0; x < bpp; x++) data[i + x] = (data[di + x] + (data[i + x - bpl] >> 1)) & 255;
                    for (let x = bpp; x < bpl; x++) data[i + x] = (data[di + x] + ((data[i + x - bpl] + data[i + x - bpp]) >> 1)) & 255;
                }

                if (type == 4) {
                    for (let x = 0; x < bpp; x++) data[i + x] = (data[di + x] + paeth(0, data[i + x - bpl], 0)) & 255;
                    for (let x = bpp; x < bpl; x++) data[i + x] = (data[di + x] + paeth(data[i + x - bpp], data[i + x - bpl], data[i + x - bpp - bpl])) & 255;
                }
            }
        }
        return data;
    }

    static _paeth(a, b, c) {
        let p = a + b - c,
            pa = Math.abs(p - a),
            pb = Math.abs(p - b),
            pc = Math.abs(p - c);
        if (pa <= pb && pa <= pc) return a;
        else if (pb <= pc) return b;
        return c;
    }

    static _IHDR(data, offset, out) {
        let bin = _bin;
        out.width = bin.readUint(data, offset);
        offset += 4;
        out.height = bin.readUint(data, offset);
        offset += 4;
        out.depth = data[offset];
        offset++;
        out.ctype = data[offset];
        offset++;
        out.compress = data[offset];
        offset++;
        out.filter = data[offset];
        offset++;
        out.interlace = data[offset];
        offset++;
    }
}


class _bin {
    static nextZero(data, p) {
        while (data[p] != 0) p++;
        return p;
    }

    static readUshort(buff, p) {
        return (buff[p] << 8) | buff[p + 1];
    }

    static writeUshort(buff, p, n) {
        buff[p] = (n >> 8) & 255;
        buff[p + 1] = n & 255;
    }

    static readUint(buff, p) {
        return (buff[p] * (256 * 256 * 256)) + ((buff[p + 1] << 16) | (buff[p + 2] << 8) | buff[p + 3]);
    }

    static writeUint(buff, p, n) {
        buff[p] = (n >> 24) & 255;
        buff[p + 1] = (n >> 16) & 255;
        buff[p + 2] = (n >> 8) & 255;
        buff[p + 3] = n & 255;
    }

    static readASCII(buff, p, l) {
        let s = "";
        for (let i = 0; i < l; i++) s += String.fromCharCode(buff[p + i]);
        return s;
    }

    static writeASCII(data, p, s) {
        for (let i = 0; i < s.length; i++) data[p + i] = s.charCodeAt(i);
    }

    static readBytes(buff, p, l) {
        let arr = [];
        for (let i = 0; i < l; i++) arr.push(buff[p + i]);
        return arr;
    }

    static pad(n) {
        return n.length < 2 ? "0" + n : n;
    }

    static readUTF8(buff, p, l) {
        let s = "",
            ns;
        for (let i = 0; i < l; i++) s += "%" + _bin.pad(buff[p + i].toString(16));
        try {
            ns = decodeURIComponent(s);
        } catch (e) {
            return _bin.readASCII(buff, p, l);
        }
        return ns;
    }
}

function _copyTile(sb, sw, sh, tb, tw, th, xoff, yoff, mode) {
    let w = Math.min(sw, tw),
        h = Math.min(sh, th);
    let si = 0,
        ti = 0;
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            if (xoff >= 0 && yoff >= 0) {
                si = (y * sw + x) << 2;
                ti = ((yoff + y) * tw + xoff + x) << 2;
            } else {
                si = ((-yoff + y) * sw - xoff + x) << 2;
                ti = (y * tw + x) << 2;
            }

            if (mode == 0) {
                tb[ti] = sb[si];
                tb[ti + 1] = sb[si + 1];
                tb[ti + 2] = sb[si + 2];
                tb[ti + 3] = sb[si + 3];
            } else if (mode == 1) {
                let fa = sb[si + 3] * (1 / 255),
                    fr = sb[si] * fa,
                    fg = sb[si + 1] * fa,
                    fb = sb[si + 2] * fa;
                let ba = tb[ti + 3] * (1 / 255),
                    br = tb[ti] * ba,
                    bg = tb[ti + 1] * ba,
                    bb = tb[ti + 2] * ba;

                let ifa = 1 - fa,
                    oa = fa + ba * ifa,
                    ioa = (oa == 0 ? 0 : 1 / oa);
                tb[ti + 3] = 255 * oa;
                tb[ti + 0] = (fr + br * ifa) * ioa;
                tb[ti + 1] = (fg + bg * ifa) * ioa;
                tb[ti + 2] = (fb + bb * ifa) * ioa;
            } else if (mode == 2) { // copy only differences, otherwise zero
                let fa = sb[si + 3],
                    fr = sb[si],
                    fg = sb[si + 1],
                    fb = sb[si + 2];
                let ba = tb[ti + 3],
                    br = tb[ti],
                    bg = tb[ti + 1],
                    bb = tb[ti + 2];
                if (fa == ba && fr == br && fg == bg && fb == bb) {
                    tb[ti] = 0;
                    tb[ti + 1] = 0;
                    tb[ti + 2] = 0;
                    tb[ti + 3] = 0;
                } else {
                    tb[ti] = fr;
                    tb[ti + 1] = fg;
                    tb[ti + 2] = fb;
                    tb[ti + 3] = fa;
                }
            } else if (mode == 3) { // check if can be blended
                let fa = sb[si + 3],
                    fr = sb[si],
                    fg = sb[si + 1],
                    fb = sb[si + 2];
                let ba = tb[ti + 3],
                    br = tb[ti],
                    bg = tb[ti + 1],
                    bb = tb[ti + 2];
                if (fa == ba && fr == br && fg == bg && fb == bb) continue;
                //if(fa!=255 && ba!=0) return false;
                if (fa < 220 && ba > 20) return false;
            }
        }
    return true;
}


export function encodeBuffer(bufs, w, h, ps, dels, forbidPlte) {
    if (ps == null) ps = 0;
    if (forbidPlte == null) forbidPlte = false;

    let nimg = encode.compress(bufs, w, h, ps, false, forbidPlte);
    encode.compressPNG(nimg, -1);

    return encode._main(nimg, w, h, dels);
}

function encodeLL(bufs, w, h, cc, ac, depth, dels) {
    let nimg = {
        ctype: 0 + (cc == 1 ? 0 : 2) + (ac == 0 ? 0 : 4),
        depth: depth,
        frames: []
    };

    let bipp = (cc + ac) * depth,
        bipl = bipp * w;
    for (let i = 0; i < bufs.length; i++) nimg.frames.push({
        rect: {
            x: 0,
            y: 0,
            width: w,
            height: h
        },
        img: new Uint8Array(bufs[i]),
        blend: 0,
        dispose: 1,
        bpp: Math.ceil(bipp / 8),
        bpl: Math.ceil(bipl / 8)
    });

    encode.compressPNG(nimg, 4);

    return encode._main(nimg, w, h, dels);
}

class encode {

    static _main(nimg, w, h, dels) {
        let crcFn = crc.crcFn,
            wUi = _bin.writeUint,
            wUs = _bin.writeUshort,
            wAs = _bin.writeASCII;
        let offset = 8,
            anim = nimg.frames.length > 1,
            pltAlpha = false;

        let leng = 8 + (16 + 5 + 4) + (9 + 4) + (anim ? 20 : 0);
        if (nimg.ctype == 3) {
            let dl = nimg.plte.length;
            for (let i = 0; i < dl; i++)
                if ((nimg.plte[i] >>> 24) != 255) pltAlpha = true;
            leng += (8 + dl * 3 + 4) + (pltAlpha ? (8 + dl * 1 + 4) : 0);
        }
        for (let j = 0; j < nimg.frames.length; j++) {
            let fr = nimg.frames[j];
            if (anim) leng += 38;
            leng += fr.cimg.length + 12;
            if (j != 0) leng += 4;
        }
        leng += 12;

        let data = new Uint8Array(leng);
        let wr = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        for (let i = 0; i < 8; i++) data[i] = wr[i];

        wUi(data, offset, 13);
        offset += 4;
        wAs(data, offset, "IHDR");
        offset += 4;
        wUi(data, offset, w);
        offset += 4;
        wUi(data, offset, h);
        offset += 4;
        data[offset] = nimg.depth;
        offset++; // depth
        data[offset] = nimg.ctype;
        offset++; // ctype
        data[offset] = 0;
        offset++; // compress
        data[offset] = 0;
        offset++; // filter
        data[offset] = 0;
        offset++; // interlace
        wUi(data, offset, crcFn(data, offset - 17, 17));
        offset += 4; // crc
        // 9 bytes to say, that it is sRGB
        wUi(data, offset, 1);
        offset += 4;
        wAs(data, offset, "sRGB");
        offset += 4;
        data[offset] = 1;
        offset++;
        wUi(data, offset, crcFn(data, offset - 5, 5));
        offset += 4; // crc
        if (anim) {
            wUi(data, offset, 8);
            offset += 4;
            wAs(data, offset, "acTL");
            offset += 4;
            wUi(data, offset, nimg.frames.length);
            offset += 4;
            wUi(data, offset, 0);
            offset += 4;
            wUi(data, offset, crcFn(data, offset - 12, 12));
            offset += 4; // crc
        }

        if (nimg.ctype == 3) {
            let dl = nimg.plte.length;
            wUi(data, offset, dl * 3);
            offset += 4;
            wAs(data, offset, "PLTE");
            offset += 4;
            for (let i = 0; i < dl; i++) {
                let ti = i * 3,
                    c = nimg.plte[i],
                    r = (c) & 255,
                    g = (c >>> 8) & 255,
                    b = (c >>> 16) & 255;
                data[offset + ti + 0] = r;
                data[offset + ti + 1] = g;
                data[offset + ti + 2] = b;
            }
            offset += dl * 3;
            wUi(data, offset, crcFn(data, offset - dl * 3 - 4, dl * 3 + 4));
            offset += 4; // crc
            if (pltAlpha) {
                wUi(data, offset, dl);
                offset += 4;
                wAs(data, offset, "tRNS");
                offset += 4;
                for (let i = 0; i < dl; i++) data[offset + i] = (nimg.plte[i] >>> 24) & 255;
                offset += dl;
                wUi(data, offset, crcFn(data, offset - dl - 4, dl + 4));
                offset += 4; // crc
            }
        }

        let fi = 0;
        for (let j = 0; j < nimg.frames.length; j++) {
            let fr = nimg.frames[j];
            if (anim) {
                wUi(data, offset, 26);
                offset += 4;
                wAs(data, offset, "fcTL");
                offset += 4;
                wUi(data, offset, fi++);
                offset += 4;
                wUi(data, offset, fr.rect.width);
                offset += 4;
                wUi(data, offset, fr.rect.height);
                offset += 4;
                wUi(data, offset, fr.rect.x);
                offset += 4;
                wUi(data, offset, fr.rect.y);
                offset += 4;
                wUs(data, offset, dels[j]);
                offset += 2;
                wUs(data, offset, 1000);
                offset += 2;
                data[offset] = fr.dispose;
                offset++; // dispose
                data[offset] = fr.blend;
                offset++; // blend
                wUi(data, offset, crcFn(data, offset - 30, 30));
                offset += 4; // crc
            }

            let imgd = fr.cimg,
                dl = imgd.length;
            wUi(data, offset, dl + (j == 0 ? 0 : 4));
            offset += 4;
            let ioff = offset;
            wAs(data, offset, (j == 0) ? "IDAT" : "fdAT");
            offset += 4;
            if (j != 0) {
                wUi(data, offset, fi++);
                offset += 4;
            }
            for (let i = 0; i < dl; i++) data[offset + i] = imgd[i];
            offset += dl;
            wUi(data, offset, crcFn(data, ioff, offset - ioff));
            offset += 4; // crc
        }

        wUi(data, offset, 0);
        offset += 4;
        wAs(data, offset, "IEND");
        offset += 4;
        wUi(data, offset, crcFn(data, offset - 4, 4));
        offset += 4; // crc
        return data.buffer;
    }

    static compressPNG(out, filter) {
        for (let i = 0; i < out.frames.length; i++) {
            let frm = out.frames[i],
                nw = frm.rect.width,
                nh = frm.rect.height;
            let fdata = new Uint8Array(nh * frm.bpl + nh);
            frm.cimg = encode._filterZero(frm.img, nh, frm.bpp, frm.bpl, fdata, filter);
        }
    }

    static compress(bufs, w, h, ps, forGIF, forbidPlte) {
        //let time = Date.now();
        if (forbidPlte == null) forbidPlte = false;

        let ctype = 6,
            depth = 8,
            alphaAnd = 255

        for (let j = 0; j < bufs.length; j++) { // when not quantized, other frames can contain colors, that are not in an initial frame
            let img = new Uint8Array(bufs[j]),
                ilen = img.length;
            for (let i = 0; i < ilen; i += 4) alphaAnd &= img[i + 3];
        }
        let gotAlpha = (alphaAnd != 255);

        //console.log("alpha check", Date.now()-time);  time = Date.now();
        let brute = gotAlpha && forGIF; // brute : frames can only be copied, not "blended"
        let frms = encode.framize(bufs, w, h, forGIF, brute);
        //console.log("framize", Date.now()-time);  time = Date.now();
        let cmap = {},
            plte = [],
            inds = [];

        if (ps != 0) {
            let nbufs = [];
            for (let i = 0; i < frms.length; i++) nbufs.push(frms[i].img.buffer);

            let abuf = encode.concatRGBA(nbufs, forGIF),
                qres = quantize.quantizeFN(abuf, ps);
            let cof = 0,
                bb = new Uint8Array(qres.abuf);
            for (let i = 0; i < frms.length; i++) {
                let ti = frms[i].img,
                    bln = ti.length;
                inds.push(new Uint8Array(qres.inds.buffer, cof >> 2, bln >> 2));
                for (let j = 0; j < bln; j += 4) {
                    ti[j] = bb[cof + j];
                    ti[j + 1] = bb[cof + j + 1];
                    ti[j + 2] = bb[cof + j + 2];
                    ti[j + 3] = bb[cof + j + 3];
                }
                cof += bln;
            }

            for (let i = 0; i < qres.plte.length; i++) plte.push(qres.plte[i].est.rgba);
            //console.log("quantize", Date.now()-time);  time = Date.now();
        } else {
            // what if ps==0, but there are <=256 colors?  we still need to detect, if the palette could be used
            for (let j = 0; j < frms.length; j++) { // when not quantized, other frames can contain colors, that are not in an initial frame
                let frm = frms[j],
                    img32 = new Uint32Array(frm.img.buffer),
                    nw = frm.rect.width,
                    ilen = img32.length;
                let ind = new Uint8Array(ilen);
                inds.push(ind);
                for (let i = 0; i < ilen; i++) {
                    let c = img32[i];
                    if (i != 0 && c == img32[i - 1]) ind[i] = ind[i - 1];
                    else if (i > nw && c == img32[i - nw]) ind[i] = ind[i - nw];
                    else {
                        let cmc = cmap[c];
                        if (cmc == null) {
                            cmap[c] = cmc = plte.length;
                            plte.push(c);
                            if (plte.length >= 300) break;
                        }
                        ind[i] = cmc;
                    }
                }
            }
            //console.log("make palette", Date.now()-time);  time = Date.now();
        }

        let cc = plte.length; //console.log("colors:",cc);
        if (cc <= 256 && forbidPlte == false) {
            if (cc <= 2) depth = 1;
            else if (cc <= 4) depth = 2;
            else if (cc <= 16) depth = 4;
            else depth = 8;
            if (forGIF) depth = 8;
        }

        for (let j = 0; j < frms.length; j++) {
            let frm = frms[j],
                nx = frm.rect.x,
                ny = frm.rect.y,
                nw = frm.rect.width,
                nh = frm.rect.height;
            let cimg = frm.img,
                cimg32 = new Uint32Array(cimg.buffer);
            let bpl = 4 * nw,
                bpp = 4;
            if (cc <= 256 && forbidPlte == false) {
                bpl = Math.ceil(depth * nw / 8);
                let nimg = new Uint8Array(bpl * nh);
                let inj = inds[j];
                for (let y = 0; y < nh; y++) {
                    let i = y * bpl,
                        ii = y * nw;
                    if (depth == 8)
                        for (let x = 0; x < nw; x++) nimg[i + (x)] = (inj[ii + x]);
                    else if (depth == 4)
                        for (let x = 0; x < nw; x++) nimg[i + (x >> 1)] |= (inj[ii + x] << (4 - (x & 1) * 4));
                    else if (depth == 2)
                        for (let x = 0; x < nw; x++) nimg[i + (x >> 2)] |= (inj[ii + x] << (6 - (x & 3) * 2));
                    else if (depth == 1)
                        for (let x = 0; x < nw; x++) nimg[i + (x >> 3)] |= (inj[ii + x] << (7 - (x & 7) * 1));
                }
                cimg = nimg;
                ctype = 3;
                bpp = 1;
            } else if (gotAlpha == false && frms.length == 1) { // some next "reduced" frames may contain alpha for blending
                let nimg = new Uint8Array(nw * nh * 3),
                    area = nw * nh;
                for (let i = 0; i < area; i++) {
                    let ti = i * 3,
                        qi = i * 4;
                    nimg[ti] = cimg[qi];
                    nimg[ti + 1] = cimg[qi + 1];
                    nimg[ti + 2] = cimg[qi + 2];
                }
                cimg = nimg;
                ctype = 2;
                bpp = 3;
                bpl = 3 * nw;
            }
            frm.img = cimg;
            frm.bpl = bpl;
            frm.bpp = bpp;
        }
        //console.log("colors => palette indices", Date.now()-time);  time = Date.now();
        return {
            ctype: ctype,
            depth: depth,
            plte: plte,
            frames: frms
        };
    }

    static framize(bufs, w, h, forGIF, brute) {
        let frms = [];
        for (let j = 0; j < bufs.length; j++) {
            let cimg = new Uint8Array(bufs[j]),
                cimg32 = new Uint32Array(cimg.buffer);

            let nx = 0,
                ny = 0,
                nw = w,
                nh = h,
                blend = 0;
            if (j != 0 && !brute) {
                let tlim = (forGIF || j == 1 || frms[frms.length - 2].dispose == 2) ? 1 : 2,
                    tstp = 0,
                    tarea = 1e9;
                for (let it = 0; it < tlim; it++) {
                    let pimg = new Uint8Array(bufs[j - 1 - it]),
                        p32 = new Uint32Array(bufs[j - 1 - it]);
                    let mix = w,
                        miy = h,
                        max = -1,
                        may = -1;
                    for (let y = 0; y < h; y++)
                        for (let x = 0; x < w; x++) {
                            let i = y * w + x;
                            if (cimg32[i] != p32[i]) {
                                if (x < mix) mix = x;
                                if (x > max) max = x;
                                if (y < miy) miy = y;
                                if (y > may) may = y;
                            }
                        }
                    let sarea = (max == -1) ? 1 : (max - mix + 1) * (may - miy + 1);
                    if (sarea < tarea) {
                        tarea = sarea;
                        tstp = it;
                        if (max == -1) {
                            nx = ny = 0;
                            nw = nh = 1;
                        } else {
                            nx = mix;
                            ny = miy;
                            nw = max - mix + 1;
                            nh = may - miy + 1;
                        }
                    }
                }

                let pimg = new Uint8Array(bufs[j - 1 - tstp]);
                if (tstp == 1) frms[frms.length - 1].dispose = 2;

                let nimg = new Uint8Array(nw * nh * 4),
                    nimg32 = new Uint32Array(nimg.buffer);
                _copyTile(pimg, w, h, nimg, nw, nh, -nx, -ny, 0);
                if (_copyTile(cimg, w, h, nimg, nw, nh, -nx, -ny, 3)) {
                    _copyTile(cimg, w, h, nimg, nw, nh, -nx, -ny, 2);
                    blend = 1;
                } else {
                    _copyTile(cimg, w, h, nimg, nw, nh, -nx, -ny, 0);
                    blend = 0;
                }
                cimg = nimg;
            } else cimg = cimg.slice(0); // img may be rewrited further ... don't rewrite input
            frms.push({
                rect: {
                    x: nx,
                    y: ny,
                    width: nw,
                    height: nh
                },
                img: cimg,
                blend: blend,
                dispose: brute ? 1 : 0
            });
        }
        return frms;
    }

    static _filterZero(img, h, bpp, bpl, data, filter) {
        if (filter != -1) {
            for (let y = 0; y < h; y++) encode._filterLine(data, img, y, bpl, bpp, filter);
            return pako["deflate"](data);
        }
        let fls = [];
        for (let t = 0; t < 5; t++) {
            if (h * bpl > 500000 && (t == 2 || t == 3 || t == 4)) continue;
            for (let y = 0; y < h; y++) encode._filterLine(data, img, y, bpl, bpp, t);
            fls.push(pako["deflate"](data));
            if (bpp == 1) break;
        }
        let ti, tsize = 1e9;
        for (let i = 0; i < fls.length; i++)
            if (fls[i].length < tsize) {
                ti = i;
                tsize = fls[i].length;
            }
        return fls[ti];
    }

    static _filterLine(data: Array<number>, img: Array<number>, y: number, bpl: number, bpp: number, type: number) {
        let i = y * bpl,
            di = i + y,
            paeth = decode._paeth;
        data[di] = type;
        di++;

        if (type == 0)
            for (let x = 0; x < bpl; x++) data[di + x] = img[i + x];
        else if (type == 1) {
            for (let x = 0; x < bpp; x++) data[di + x] = img[i + x];
            for (let x = bpp; x < bpl; x++) data[di + x] = (img[i + x] - img[i + x - bpp] + 256) & 255;
        } else if (y == 0) {
            for (let x = 0; x < bpp; x++) data[di + x] = img[i + x];

            if (type == 2)
                for (let x = bpp; x < bpl; x++) data[di + x] = img[i + x];
            if (type == 3)
                for (let x = bpp; x < bpl; x++) data[di + x] = (img[i + x] - (img[i + x - bpp] >> 1) + 256) & 255;
            if (type == 4)
                for (let x = bpp; x < bpl; x++) data[di + x] = (img[i + x] - paeth(img[i + x - bpp], 0, 0) + 256) & 255;
        } else {
            if (type == 2) {
                for (let x = 0; x < bpl; x++) data[di + x] = (img[i + x] + 256 - img[i + x - bpl]) & 255;
            }
            if (type == 3) {
                for (let x = 0; x < bpp; x++) data[di + x] = (img[i + x] + 256 - (img[i + x - bpl] >> 1)) & 255;
                for (let x = bpp; x < bpl; x++) data[di + x] = (img[i + x] + 256 - ((img[i + x - bpl] + img[i + x - bpp]) >> 1)) & 255;
            }
            if (type == 4) {
                for (let x = 0; x < bpp; x++) data[di + x] = (img[i + x] + 256 - paeth(0, img[i + x - bpl], 0)) & 255;
                for (let x = bpp; x < bpl; x++) data[di + x] = (img[i + x] + 256 - paeth(img[i + x - bpp], img[i + x - bpl], img[i + x - bpp - bpl])) & 255;
            }
        }
    }

    static concatRGBA(bufs, roundAlpha) {
        let tlen = 0;
        for (let i = 0; i < bufs.length; i++) tlen += bufs[i].byteLength;
        let nimg = new Uint8Array(tlen),
            noff = 0;
        for (let i = 0; i < bufs.length; i++) {
            let img = new Uint8Array(bufs[i]),
                il = img.length;
            for (let j = 0; j < il; j += 4) {
                let r = img[j],
                    g = img[j + 1],
                    b = img[j + 2],
                    a = img[j + 3];
                if (roundAlpha) a = (a & 128) == 0 ? 0 : 255;
                if (a == 0) r = g = b = 0;
                nimg[noff + j] = r;
                nimg[noff + j + 1] = g;
                nimg[noff + j + 2] = b;
                nimg[noff + j + 3] = a;
            }
            noff += il;
        }
        return nimg.buffer;
    }

}


class crc {
    static crcFn(b: Uint8Array, o: number, l: number) {
        return crc.update(0xffffffff, b, o, l) ^ 0xffffffff;
    }

    static table() {
        let tab = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                if (c & 1) c = 0xedb88320 ^ (c >>> 1);
                else c = c >>> 1;
            }
            tab[n] = c;
        }
        return tab;
    }

    static update(c: number, buf: Uint8Array, off: number, len: number) {
        for (let i = 0; i < len; i++) c = crc.table[(c ^ buf[off + i]) & 0xff] ^ (c >>> 8);
        return c;
    }
}

class quantize {
    static quantizeFN(abuf, ps) {
        let oimg = new Uint8Array(abuf),
            nimg = oimg.slice(0),
            nimg32 = new Uint32Array(nimg.buffer);

        let KD = quantize.getKDtree(nimg, ps);
        let {root, leafs} = KD;

        let planeDst = quantize.planeDst;
        let sb = oimg,
            tb = nimg32,
            len = sb.length;

        let inds = new Uint8Array(oimg.length >> 2);
        for (let i = 0; i < len; i += 4) {
            let r = sb[i] * (1 / 255),
                g = sb[i + 1] * (1 / 255),
                b = sb[i + 2] * (1 / 255),
                a = sb[i + 3] * (1 / 255);

            //  exact, but too slow :(
            let nd = quantize.getNearest(root, r, g, b, a);
            //let nd = root;
            //while(nd.left) nd = (planeDst(nd.est,r,g,b,a)<=0) ? nd.left : nd.right;
            inds[i >> 2] = nd.ind;
            tb[i >> 2] = nd.est.rgba;
        }
        return {
            abuf: nimg.buffer,
            inds: inds,
            plte: leafs
        };
    }

    static getKDtree(nimg, ps, err?) {
        if (err == null) err = 0.0001;
        let nimg32 = new Uint32Array(nimg.buffer);

        let root = {
            i0: 0,
            i1: nimg.length,
            bst: null,
            est: null,
            tdst: 0,
            left: null,
            right: null,
            //ind: null
            ind: null
        }; // basic statistic, extra statistic
        root.bst = quantize.stats(nimg, root.i0, root.i1);
        root.est = quantize.estats(root.bst);
        let leafs = [root];

        while (leafs.length < ps) {
            let maxL = 0,
                mi = 0;
            for (let i = 0; i < leafs.length; i++)
                if (leafs[i].est.L > maxL) {
                    maxL = leafs[i].est.L;
                    mi = i;
                }
            if (maxL < err) break;
            let node = leafs[mi];

            let s0 = quantize.splitPixels(nimg, nimg32, node.i0, node.i1, node.est.e, node.est.eMq255);
            let s0wrong = (node.i0 >= s0 || node.i1 <= s0);
            //console.log(maxL, leafs.length, mi);
            if (s0wrong) {
                node.est.L = 0;
                continue;
            }

            let ln = {
                i0: node.i0,
                i1: s0,
                bst: null,
                est: null,
                tdst: 0,
                left: null,
                right: null,
                ind: null
            };
            ln.bst = quantize.stats(nimg, ln.i0, ln.i1);
            ln.est = quantize.estats(ln.bst);
            let rn = {
                i0: s0,
                i1: node.i1,
                bst: null,
                est: null,
                tdst: 0,
                left: null,
                right: null,
                ind: null
            };
            rn.bst = {
                R: [],
                m: [],
                N: node.bst.N - ln.bst.N
            };
            for (let i = 0; i < 16; i++) rn.bst.R[i] = node.bst.R[i] - ln.bst.R[i];
            for (let i = 0; i < 4; i++) rn.bst.m[i] = node.bst.m[i] - ln.bst.m[i];
            rn.est = quantize.estats(rn.bst);

            node.left = ln;
            node.right = rn;
            leafs[mi] = ln;
            leafs.push(rn);
        }
        leafs.sort(function (a, b) {
            return b.bst.N - a.bst.N;
        });
        for (let i = 0; i < leafs.length; i++) leafs[i].ind = i;
        return {root, leafs};
    }


    static getNearest(nd, r, g, b, a) {
        if (nd.left == null) {
            nd.tdst = quantize.dist(nd.est.q, r, g, b, a);
            return nd;
        }
        let planeDst = quantize.planeDst(nd.est, r, g, b, a);

        let node0 = nd.left,
            node1 = nd.right;
        if (planeDst > 0) {
            node0 = nd.right;
            node1 = nd.left;
        }

        let ln = quantize.getNearest(node0, r, g, b, a);
        if (ln.tdst <= planeDst * planeDst) return ln;
        let rn = quantize.getNearest(node1, r, g, b, a);
        return rn.tdst < ln.tdst ? rn : ln;
    }

    static planeDst(est, r, g, b, a) {
        let e = est.e;
        return e[0] * r + e[1] * g + e[2] * b + e[3] * a - est.eMq;
    }

    static dist(q, r, g, b, a) {
        let d0 = r - q[0],
            d1 = g - q[1],
            d2 = b - q[2],
            d3 = a - q[3];
        return d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3;
    }

    static splitPixels(nimg, nimg32, i0, i1, e, eMq) {
        let vecDot = quantize.vecDot;
        i1 -= 4;
        let shfs = 0;
        while (i0 < i1) {
            while (vecDot(nimg, i0, e) <= eMq) i0 += 4;
            while (vecDot(nimg, i1, e) > eMq) i1 -= 4;
            if (i0 >= i1) break;

            let t = nimg32[i0 >> 2];
            nimg32[i0 >> 2] = nimg32[i1 >> 2];
            nimg32[i1 >> 2] = t;

            i0 += 4;
            i1 -= 4;
        }
        while (vecDot(nimg, i0, e) > eMq) i0 -= 4;
        return i0 + 4;
    }

    static vecDot(nimg, i, e) {
        return nimg[i] * e[0] + nimg[i + 1] * e[1] + nimg[i + 2] * e[2] + nimg[i + 3] * e[3];
    }

    static stats(nimg, i0, i1) {
        let R = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let m = [0, 0, 0, 0];
        let N = (i1 - i0) >> 2;
        for (let i = i0; i < i1; i += 4) {
            let r = nimg[i] * (1 / 255),
                g = nimg[i + 1] * (1 / 255),
                b = nimg[i + 2] * (1 / 255),
                a = nimg[i + 3] * (1 / 255);
            //let r = nimg[i], g = nimg[i+1], b = nimg[i+2], a = nimg[i+3];
            m[0] += r;
            m[1] += g;
            m[2] += b;
            m[3] += a;

            R[0] += r * r;
            R[1] += r * g;
            R[2] += r * b;
            R[3] += r * a;
            R[5] += g * g;
            R[6] += g * b;
            R[7] += g * a;
            R[10] += b * b;
            R[11] += b * a;
            R[15] += a * a;
        }
        R[4] = R[1];
        R[8] = R[2];
        R[9] = R[6];
        R[12] = R[3];
        R[13] = R[7];
        R[14] = R[11];

        return {
            R: R,
            m: m,
            N: N
        };
    }

    static estats(stats) {
        let R = stats.R,
            m = stats.m,
            N = stats.N;

        // when all samples are equal, but N is large (millions), the Rj can be non-zero ( 0.0003.... - precission error)
        let m0 = m[0],
            m1 = m[1],
            m2 = m[2],
            m3 = m[3],
            iN = (N == 0 ? 0 : 1 / N);
        let Rj = [R[0] - m0 * m0 * iN, R[1] - m0 * m1 * iN, R[2] - m0 * m2 * iN, R[3] - m0 * m3 * iN, R[4] - m1 * m0 * iN, R[5] - m1 * m1 * iN, R[6] - m1 * m2 * iN, R[7] - m1 * m3 * iN, R[8] - m2 * m0 * iN, R[9] - m2 * m1 * iN, R[10] - m2 * m2 * iN, R[11] - m2 * m3 * iN, R[12] - m3 * m0 * iN, R[13] - m3 * m1 * iN, R[14] - m3 * m2 * iN, R[15] - m3 * m3 * iN];

        let A = Rj,
            M = M4;
        let b = [0.5, 0.5, 0.5, 0.5],
            mi = 0,
            tmi = 0;

        if (N != 0)
            for (let i = 0; i < 10; i++) {
                b = M.multVec(A, b);
                tmi = Math.sqrt(M.dot(b, b));
                b = M.sml(1 / tmi, b);
                if (Math.abs(tmi - mi) < 1e-9) break;
                mi = tmi;
            }
        //b = [0,0,1,0];  mi=N;
        let q = [m0 * iN, m1 * iN, m2 * iN, m3 * iN];
        let eMq255 = M.dot(M.sml(255, q), b);

        return {
            Cov: Rj,
            q: q,
            e: b,
            L: mi,
            eMq255: eMq255,
            eMq: M.dot(b, q),
            rgba: (((Math.round(255 * q[3]) << 24) | (Math.round(255 * q[2]) << 16) | (Math.round(255 * q[1]) << 8) | (Math.round(255 * q[0]) << 0)) >>> 0)
        };
    }
}


class M4 {
    static multVec(m, v) {
        return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3] * v[3], m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7] * v[3], m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11] * v[3], m[12] * v[0] + m[13] * v[1] + m[14] * v[2] + m[15] * v[3]];
    }

    static dot(x, y) {
        return x[0] * y[0] + x[1] * y[1] + x[2] * y[2] + x[3] * y[3];
    }

    static sml(a, y) {
        return [a * y[0], a * y[1], a * y[2], a * y[3]];
    }
}



