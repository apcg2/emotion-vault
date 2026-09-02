import type { MoodLog } from './encrypted-vault';

export function previousWeekDemoLogs(today = new Date()): MoodLog[] {
  const samples = [
    {
      situation: '工作任务临时增加，担心无法按时完成。',
      thoughts: '如果今天没做完，就说明我能力不够。',
      emotions: [
        ['担忧', '焦虑', 80, 45],
        ['受挫', '沮丧', 65, 35],
      ],
      distortions: ['非黑即白', '应该句式'],
      response:
        '任务变多不等于能力不足。我可以先确认优先级，并为重要任务留出时间。',
      belief: 70,
    },
    {
      situation: '朋友迟迟没有回复消息，感到被冷落。',
      thoughts: '他一定是不想理我了。',
      emotions: [
        ['被拒绝', '孤独', 70, 35],
        ['难过', '悲伤', 60, 30],
      ],
      distortions: ['妄下结论', '情绪化推理'],
      response: '没有及时回复有很多原因。目前没有证据说明他在拒绝我。',
      belief: 80,
    },
    {
      situation: '周末计划被打乱，原本期待的活动取消。',
      thoughts: '这一天彻底毁了，什么都做不好。',
      emotions: [
        ['受阻', '沮丧', 60, 60],
        ['恼怒', '愤怒', 55, 40],
      ],
      distortions: ['过度概括', '放大与缩小'],
      response:
        '失望是自然的。今天仍有一些可以自主安排的小事，不必马上让自己开心起来。',
      belief: 55,
    },
    {
      situation: '家庭沟通中产生分歧，讨论后仍有些不舒服。',
      thoughts: '对方不赞同我，就是完全不理解我。',
      emotions: [
        ['恼怒', '愤怒', 50, 60],
        ['委屈', '其他', 65, 55],
      ],
      distortions: ['非黑即白', '妄下结论'],
      response:
        '分歧不代表否定。我现在仍有情绪，可以暂停讨论，等平静后表达具体需求。',
      belief: 50,
    },
    {
      situation: '回顾本周工作，反复想到一次小失误。',
      thoughts: '我总是出错，之前的努力都不算什么。',
      emotions: [
        ['羞愧', '愧疚', 75, 40],
        ['无能', '自卑', 65, 30],
      ],
      distortions: ['心理过滤', '否定正面', '贴标签'],
      response:
        '一次失误不能概括整个人。我也完成了不少任务，复盘一个具体改进点就够了。',
      belief: 75,
    },
    {
      situation: '周一面对新的安排，担心接下来会很忙。',
      thoughts: '事情一定会越来越糟，我肯定应付不了。',
      emotions: [
        ['紧张', '焦虑', 65, 35],
        ['没有干劲', '无望', 45, 25],
      ],
      distortions: ['妄下结论', '放大与缩小'],
      response:
        '担忧不是预测。我可以将工作拆成小步骤，先完成今天最重要的一件事。',
      belief: 80,
    },
    {
      situation: '尝试提出一个新想法，担心别人觉得不成熟。',
      thoughts: '我的建议必须完美，否则会被笑话。',
      emotions: [
        ['害羞', '尴尬', 55, 25],
        ['担忧', '焦虑', 50, 20],
      ],
      distortions: ['应该句式', '妄下结论'],
      response:
        '建议不必完美才值得表达。讨论本来就是为了共同改进，反馈并不等于否定。',
      belief: 85,
    },
  ];
  return samples.map((sample, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 7 + index,
      20,
      15 + index * 3,
    );
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      id: `moodflow-demo-v1-${day}`,
      ts: date.toISOString(),
      situation: `【模拟数据】${sample.situation}`,
      thoughts: sample.thoughts,
      emotions: sample.emotions.map(([name, category, before, after]) => ({
        name: String(name),
        category: String(category),
        before: Number(before),
        after: Number(after),
      })),
      distortions: sample.distortions,
      responses: [{ text: sample.response, belief: sample.belief }],
    };
  });
}
