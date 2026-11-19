import sharp from 'sharp';
import potrace from 'potrace';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const MOD = 'src/data/otto-man-path.js';
const ORIG = 'src/data/otto-man-path.no-shoes.js';
if (!existsSync(ORIG)) copyFileSync(MOD, ORIG);
const src = readFileSync(ORIG, 'utf8');
const path = JSON.parse(src.match(/export const path = (".*");/)[1]);
const crop = src.match(/export const crop = (\{[^}]+\});/)[1];

const W = 1270, H = 1830;
const S = 2;

const STROKES = [
  [5, 'M 930 1410 C 931 1436, 936 1458, 943 1486'],

  [5.5, 'M 600 1700 C 604 1684, 620 1676, 640 1674 C 664 1673, 680 1677, 684 1686 C 686 1690, 686 1693, 685 1696'],
  [4.5, 'M 600 1700 C 599 1708, 599 1716, 600 1722'],
  [4.5, 'M 586 1678 C 586 1684, 585 1690, 585 1696'],
  [5.5, 'M 585 1696 C 578 1715, 571 1745, 567 1770 C 565 1786, 563 1796, 563 1802'],
  [5.5, 'M 686 1696 C 690 1718, 695 1744, 699 1768 C 702 1784, 704 1794, 705 1800'],
  [4.5, 'M 589 1746 C 597 1765, 614 1778, 650 1783'],
  [4.5, 'M 688 1718 C 689 1734, 689 1750, 689 1766'],
  [5.5, 'M 563 1801 C 590 1806, 650 1808, 705 1803'],
  [5.5, 'M 566 1811 C 600 1816, 660 1817, 710 1812'],

  [5.5, 'M 938 1663 C 934 1686, 931 1708, 931 1728 C 931 1742, 932 1752, 934 1760'],
  [5.5, 'M 944 1666 C 960 1673, 978 1681, 996 1688 C 1014 1695, 1032 1702, 1046 1707'],
  [4.5, 'M 940 1660 C 950 1658, 960 1659, 968 1663'],
  [5.5, 'M 1083 1659 C 1066 1661, 1054 1668, 1050 1682 C 1047 1696, 1053 1712, 1064 1722 C 1068 1727, 1071 1731, 1073 1735'],
  [5.5, 'M 1086 1659 C 1100 1659, 1112 1661, 1118 1668 C 1128 1682, 1138 1700, 1152 1716 C 1168 1734, 1192 1748, 1214 1757 C 1230 1764, 1244 1774, 1248 1786'],
  [4.5, 'M 1083 1738 C 1108 1746, 1140 1756, 1176 1762 C 1194 1766, 1206 1769, 1214 1772'],
  [5.5, 'M 935 1746 C 952 1754, 966 1759, 983 1762 C 1006 1767, 1030 1771, 1050 1773 C 1090 1780, 1130 1786, 1170 1788 C 1210 1790, 1236 1790, 1248 1786'],
  [5.5, 'M 938 1769 C 958 1775, 984 1780, 1010 1784'],
  [5.5, 'M 1020 1776 C 1042 1784, 1066 1792, 1090 1796 C 1120 1801, 1150 1804, 1190 1802 C 1220 1800, 1240 1797, 1250 1791 C 1253 1789, 1252 1787, 1248 1786'],
  [4.5, 'M 1065 1801 C 1100 1807, 1150 1812, 1190 1810 C 1216 1808, 1232 1805, 1240 1801'],
];

const strokes = STROKES.map(([w, d]) => `<path d="${d}" fill="none" stroke="#000" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
const erase = '<rect x="1080" y="1657" width="36" height="97" fill="#fff"/>';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * S}" height="${H * S}"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000" fill-rule="evenodd"/>${erase}${strokes}</svg>`;

if (process.argv.includes('--preview')) {
  await sharp(Buffer.from(svg)).extract({ left: 500 * S, top: 1350 * S, width: (W - 500) * S, height: (H - 1350) * S }).resize({ width: 1100 }).toFile('tools/otto-shoes-preview.png');
  console.log('tools/otto-shoes-preview.png');
} else {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const traced = await new Promise((res, rej) => potrace.trace(png, { turdSize: 25, optTolerance: 0.4 }, (e, out) => (e ? rej(e) : res(out))));
  const d = traced.match(/ d="([^"]+)"/)[1].replace(/-?\d+(\.\d+)?/g, (n) => (+n / S).toFixed(2).replace(/\.?0+$/, ''));
  writeFileSync(MOD, `export const viewBox = '0 0 ${W} ${H}';
export const crop = ${crop};
export const path = ${JSON.stringify(d)};
`);
  console.log('rewrote', MOD, `(viewBox ${W} × ${H})`);
}
