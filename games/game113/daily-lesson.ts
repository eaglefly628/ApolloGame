import type { HobbyId } from './data.js';

export type DailyLesson = {
  title: string;
  lead: string;
  question: string;
  answers: [string, string, string];
  correct: number;
  hint: string;
  explanation: string;
  spots: [{ x: number; y: number; title: string; body: string }, { x: number; y: number; title: string; body: string }];
};

export const DAILY_LESSONS: Record<'watch' | 'walnut' | 'woodwork' | 'car', DailyLesson> = {
  watch: {
    title: '认识机械表：时间怎样走动', lead: '先不记品牌和价格。今天只看一件事：机械怎样把储存的力量，变成均匀的节奏。',
    question: '一枚机械表里，主要负责调节走时节奏的是哪组结构？',
    answers: ['摆轮与擒纵机构', '表带与表扣', '表镜与表圈'], correct: 0,
    hint: '想一想：哪种结构会规律地往复运动，并控制能量一点点释放？',
    explanation: '摆轮往复振荡，擒纵机构控制轮系逐步释放能量。先听懂这一声“滴答”，再去认识机芯。',
    spots: [
      { x: 55, y: 45, title: '储存能量', body: '发条被上紧后储存能量，再通过齿轮系缓慢传递。图片只展示观察方式，不用于辨认具体机芯。' },
      { x: 75, y: 62, title: '控制节奏', body: '擒纵机构与摆轮配合，让能量按节奏释放，指针才得以稳定前行。' },
    ],
  },
  walnut: {
    title: '认识文玩核桃：先看一对', lead: '不急着问年份与价格。今天先学会观察两枚核桃为什么能被称为“一对”。',
    question: '观察一对文玩核桃时，哪项更值得先比较？',
    answers: ['单枚是否越亮越好', '形制、尺寸与纹路是否协调', '有没有同色的收纳盒'], correct: 1,
    hint: '“一对”的关键，是两枚放在一起时是否相称。',
    explanation: '配对先看形制与尺寸，再比较纹路的节奏。真实品相必须依据多角度实拍，不能凭示意图判断。',
    spots: [
      { x: 34, y: 50, title: '看轮廓', body: '把两枚并排，留意高度、宽度与肩部轮廓是否接近。' },
      { x: 67, y: 52, title: '看纹路', body: '观察纹路疏密与走向是否协调；示意图不用于真实鉴定。' },
    ],
  },
  woodwork: {
    title: '认识木工：一处连接的巧思', lead: '今天先看木件怎样相接。懂得连接，才更容易理解一件木作的结构之美。',
    question: '传统榫卯最核心的想法是什么？',
    answers: ['只靠表面涂层固定', '让木件凭结构互相咬合', '把木材全部雕空'], correct: 1,
    hint: '“榫”与“卯”像一组彼此配合的形状。',
    explanation: '榫与卯通过形状配合连接木件。不同结构有不同做法，观察时可以先寻找连接处。',
    spots: [
      { x: 53, y: 48, title: '找连接处', body: '从椅腿、横撑和座面相接的位置，开始理解木作的受力路径。' },
      { x: 72, y: 66, title: '看木纹方向', body: '木纹既是审美线索，也与切削和使用时的受力有关。具体木种要靠真实资料核对。' },
    ],
  },
  car: {
    title: '认识经典汽车：先读车身线条', lead: '先不追逐稀有型号。今天试着用造型的眼光，读懂一个时代怎样想象速度与旅行。',
    question: '欣赏经典汽车的造型时，哪种观察更有帮助？',
    answers: ['只看成交价', '比较车身比例与线条', '只看车牌数字'], correct: 1,
    hint: '先把它当作一件工业设计作品。',
    explanation: '车身比例、腰线与前脸设计，常能呈现时代审美。具体车型和年代仍须依据真实车辆资料核对。',
    spots: [
      { x: 40, y: 49, title: '看车身比例', body: '留意车头、乘员舱与车尾各占多少长度，体会它呈现的姿态。' },
      { x: 70, y: 62, title: '看前脸语言', body: '格栅和灯具的组合会形成一辆车的表情；示意图不用于识别真实车型。' },
    ],
  },
};

export function dailyLessonFor(id: HobbyId): DailyLesson {
  return DAILY_LESSONS[id as keyof typeof DAILY_LESSONS] || DAILY_LESSONS.watch;
}

export function dailyCompletionKey(id: HobbyId, date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}:${id}`;
}
