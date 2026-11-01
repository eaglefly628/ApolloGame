/** Version 1 yaw basis: 65536 units/turn, +Z forward, +quarter faces +X.
 * Checked-in Q1e6 quarter-wave samples, 1024 directions; no runtime transcendental functions.
 * Arbitrary yaw linearly interpolates adjacent entries. Vector coordinates bounded to +/-1e9.
 * Direction selection quantizes to nearest table direction; exact half-turn steering chooses positive.
 */
export const YAW_TURN = 65536;
export const YAW_BASIS_VERSION = 1;
const SCALE = 1000000;
const QUARTER = Object.freeze([
  0, 6136, 12272, 18407, 24541, 30675, 36807, 42938, 49068, 55195, 61321, 67444,
  73565, 79682, 85797, 91909, 98017, 104122, 110222, 116319, 122411, 128498, 134581, 140658,
  146730, 152797, 158858, 164913, 170962, 177004, 183040, 189069, 195090, 201105, 207111, 213110,
  219101, 225084, 231058, 237024, 242980, 248928, 254866, 260794, 266713, 272621, 278520, 284408,
  290285, 296151, 302006, 307850, 313682, 319502, 325310, 331106, 336890, 342661, 348419, 354164,
  359895, 365613, 371317, 377007, 382683, 388345, 393992, 399624, 405241, 410843, 416430, 422000,
  427555, 433094, 438616, 444122, 449611, 455084, 460539, 465976, 471397, 476799, 482184, 487550,
  492898, 498228, 503538, 508830, 514103, 519356, 524590, 529804, 534998, 540171, 545325, 550458,
  555570, 560662, 565732, 570781, 575808, 580814, 585798, 590760, 595699, 600616, 605511, 610383,
  615232, 620057, 624859, 629638, 634393, 639124, 643832, 648514, 653173, 657807, 662416, 667000,
  671559, 676093, 680601, 685084, 689541, 693971, 698376, 702755, 707107, 711432, 715731, 720003,
  724247, 728464, 732654, 736817, 740951, 745058, 749136, 753187, 757209, 761202, 765167, 769103,
  773010, 776888, 780737, 784557, 788346, 792107, 795837, 799537, 803208, 806848, 810457, 814036,
  817585, 821103, 824589, 828045, 831470, 834863, 838225, 841555, 844854, 848120, 851355, 854558,
  857729, 860867, 863973, 867046, 870087, 873095, 876070, 879012, 881921, 884797, 887640, 890449,
  893224, 895966, 898674, 901349, 903989, 906596, 909168, 911706, 914210, 916679, 919114, 921514,
  923880, 926210, 928506, 930767, 932993, 935184, 937339, 939459, 941544, 943593, 945607, 947586,
  949528, 951435, 953306, 955141, 956940, 958703, 960431, 962121, 963776, 965394, 966976, 968522,
  970031, 971504, 972940, 974339, 975702, 977028, 978317, 979570, 980785, 981964, 983105, 984210,
  985278, 986308, 987301, 988258, 989177, 990058, 990903, 991710, 992480, 993212, 993907, 994565,
  995185, 995767, 996313, 996820, 997290, 997723, 998118, 998476, 998795, 999078, 999322, 999529,
  999699, 999831, 999925, 999981, 1000000
]);
function integer(value:number,name:string,min:number,max:number):void {
  if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`yaw-fixed: invalid ${name}`);
}
function signedRound(n:bigint,d:bigint):number { return Number(n<0n?-((-n+d/2n)/d):(n+d/2n)/d); }
function wave(index:number):number {
  const i=((index%1024)+1024)%1024;
  if(i<=256)return QUARTER[i];
  if(i<=512)return QUARTER[512-i];
  if(i<=768)return -QUARTER[i-512];
  return -QUARTER[1024-i];
}
function sample(units:number):number {
  const i=Math.floor(units/64),remainder=units%64;
  return signedRound(BigInt(wave(i))*(64n-BigInt(remainder))+BigInt(wave(i+1))*BigInt(remainder),64n);
}
export function yawDirectionQ(yawUnits:number):{xQ:number;zQ:number} {
  integer(yawUnits,'yawUnits',0,YAW_TURN-1);
  return {xQ:sample(yawUnits),zQ:sample((yawUnits+16384)%YAW_TURN)};
}
function vector(xQ:number,zQ:number):void {integer(xQ,'xQ',-1000000000,1000000000);integer(zQ,'zQ',-1000000000,1000000000);}
/** Zero direction explicitly retains previous yaw. Ties quantize toward the larger first-quadrant angle. */
export function directionYawUnits(xQ:number,zQ:number,previousYaw:number):number {
  vector(xQ,zQ);integer(previousYaw,'previousYaw',0,YAW_TURN-1);
  if(xQ===0&&zQ===0)return previousYaw;
  const x=BigInt(Math.abs(xQ)),z=BigInt(Math.abs(zQ));let lo=0,hi=256;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);const bx=BigInt(wave(mid)+wave(mid+1));const bz=BigInt(wave(mid+256)+wave(mid+257));if(x*bz>=z*bx)lo=mid+1;else hi=mid;}
  const first=lo*64;
  return (xQ>=0?(zQ>=0?first:32768-first):(zQ>=0?65536-first:32768+first))%YAW_TURN;
}
export function worldToLocalQ(xQ:number,zQ:number,yawUnits:number):{lateralQ:number;forwardQ:number} {
  vector(xQ,zQ);const d=yawDirectionQ(yawUnits),x=BigInt(xQ),z=BigInt(zQ),s=BigInt(d.xQ),c=BigInt(d.zQ);
  return {lateralQ:signedRound(x*c-z*s,BigInt(SCALE)),forwardQ:signedRound(x*s+z*c,BigInt(SCALE))};
}
export function localToWorldQ(lateralQ:number,forwardQ:number,yawUnits:number):{xQ:number;zQ:number} {
  vector(lateralQ,forwardQ);const d=yawDirectionQ(yawUnits),x=BigInt(lateralQ),z=BigInt(forwardQ),s=BigInt(d.xQ),c=BigInt(d.zQ);
  return {xQ:signedRound(x*c+z*s,BigInt(SCALE)),zQ:signedRound(-x*s+z*c,BigInt(SCALE))};
}
export function advanceYaw(yawUnits:number,targetYaw:number,maxUnitsPerSecond:number,tickRate:number,remainder:number):{yawUnits:number;remainder:number;errorUnits:number} {
  integer(yawUnits,'yawUnits',0,65535);integer(targetYaw,'targetYaw',0,65535);integer(maxUnitsPerSecond,'maxUnitsPerSecond',0,655360);integer(tickRate,'tickRate',1,240);integer(remainder,'remainder',0,tickRate-1);
  let error=((targetYaw-yawUnits+32768)%65536+65536)%65536-32768;if(error===-32768)error=32768;
  const budget=maxUnitsPerSecond+remainder,step=Math.floor(budget/tickRate),used=Math.min(step,Math.abs(error));
  return {yawUnits:((yawUnits+Math.sign(error)*used)%65536+65536)%65536,remainder:used===Math.abs(error)?0:budget%tickRate,errorUnits:error-Math.sign(error)*used};
}
