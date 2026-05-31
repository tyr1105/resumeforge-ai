const SYSTEM_PROMPT_ZH = `你是一个顶级的简历定制专家。你的任务是根据用户提供的职位描述(JD)，重新定制用户的简历，使其最大程度匹配该职位。

核心原则：
1. **ATS优化**：确保简历能通过ATS(申请人追踪系统)的关键词扫描
2. **量化成果**：把模糊的描述转化为具体的、可量化的成就
3. **关键词匹配**：从JD中提取关键技能和要求，确保简历中出现这些关键词
4. **经历重塑**：重新组织经历描述，突出与目标职位最相关的部分
5. **保持诚实**：不编造不存在的工作经历或技能，只优化已有内容的表达

输出格式：
- 使用清晰的标题分隔各部分
- 用项目符号列出工作成就
- 每条成就使用"动词+任务+结果"的STAR格式
- 控制在1-2页简历的长度
- 使用纯文本格式，方便复制粘贴`;

const SYSTEM_PROMPT_EN = `You are a world-class resume tailoring expert. Your task is to customize a user's resume to maximally match a given job description (JD).

Core principles:
1. **ATS Optimization**: Ensure the resume passes ATS (Applicant Tracking System) keyword scanning
2. **Quantified Results**: Transform vague descriptions into specific, quantifiable achievements
3. **Keyword Matching**: Extract key skills and requirements from the JD and ensure they appear in the resume
4. **Experience Reshaping**: Reorganize experience descriptions to highlight the most relevant parts for the target role
5. **Stay Honest**: Never fabricate non-existent work experience or skills; only optimize the expression of existing content

Output format:
- Use clear headings to separate sections
- Use bullet points for work achievements
- Each achievement follows the STAR format (Situation-Task-Action-Result)
- Keep to 1-2 pages in length
- Use plain text format for easy copy-pasting`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { job_description, resume, lang } = req.body || {};

  if (!job_description || !resume) {
    return res.status(400).json({ error: '请提供职位描述和简历' });
  }

  const apiKey = process.env.DEEPSEEK_REASONER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务配置错误，请联系管理员' });
  }

  const systemPrompt = lang === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;
  const userPrompt = lang === 'en'
    ? `Here is the job description I want to apply for:\n\n---JOB DESCRIPTION---\n${job_description}\n\n---END JOB DESCRIPTION---\n\nHere is my current resume:\n\n---MY RESUME---\n${resume}\n\n---END RESUME---\n\nPlease tailor my resume to best match this job description. Optimize for ATS, quantify achievements, and highlight the most relevant experience.`
    : `我要申请的职位描述如下：\n\n---职位描述---\n${job_description}\n\n---职位描述结束---\n\n我当前的简历如下：\n\n---我的简历---\n${resume}\n\n---简历结束---\n\n请根据这个职位描述定制我的简历。ATS优化，量化成就，突出最相关的经验。`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 3000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('DeepSeek API error:', response.status, errBody);
      return res.status(502).json({ error: 'AI服务暂时不可用，请稍后再试' });
    }

    const data = await response.json();
    const tailoredResume = data.choices?.[0]?.message?.content;

    if (!tailoredResume) {
      return res.status(502).json({ error: 'AI生成失败，请重试' });
    }

    // 简单的频率限制：用IP + 日期做key
    // 注意：真正的限制靠客户端localStorage + 服务端验证
    const remaining = 2; // 暂时固定返回

    return res.status(200).json({
      resume: tailoredResume,
      remaining: remaining,
      model: 'deepseek-chat'
    });

  } catch (error) {
    console.error('Generate error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
