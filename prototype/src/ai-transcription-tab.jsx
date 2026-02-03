import { useState, Fragment } from 'react';

const mockInsights = {
  focusScore: 87,
  sessionGoal: "Career transition strategy and timeline planning",
  sessionDate: "February 1, 2026 at 9:30 AM CST",
  upcomingSessions: [
    { id: 1, date: "Feb 8, 2026", time: "9:30 AM", label: "Next session" },
    { id: 2, date: "Feb 15, 2026", time: "9:30 AM", label: null },
    { id: 3, date: "Feb 22, 2026", time: "9:30 AM", label: null },
    { id: 4, date: "Mar 1, 2026", time: "9:30 AM", label: null },
  ],
  sessionDuration: { total: 84, focused: 72, unfocused: 12 },
  generalThemes: [
    { name: "Fear and self-doubt patterns", timeSpent: 8 },
    { name: "Work-life balance considerations", timeSpent: 5 },
    { name: "Relationship with manager", timeSpent: 6 },
    { name: "Risk tolerance and decision-making", timeSpent: 4 },
  ],
  goalsDiscussed: [
    { name: "Clarify 6-month career vision", timeSpent: 10, discussed: true },
    { name: "Identify key blockers to progress", timeSpent: 7, discussed: true },
    { name: "Develop action plan for manager conversation", timeSpent: 5, discussed: true },
    { name: "Build confidence in decision-making", timeSpent: 0, discussed: false },
  ],
  agendaItems: [
    { name: "Review progress on previous action items", timeSpent: 5, discussed: true },
    { name: "Discuss career transition timeline", timeSpent: 12, discussed: true },
    { name: "Identify skill gaps for target roles", timeSpent: 8, discussed: true },
    { name: "Networking strategy and outreach plan", timeSpent: 7, discussed: true },
    { name: "Address concerns about financial runway", timeSpent: 4, discussed: true },
    { name: "Define success metrics for transition", timeSpent: 3, discussed: true },
    { name: "Role-play difficult conversations", timeSpent: 0, discussed: false },
    { name: "Review resume updates", timeSpent: 0, discussed: false },
  ],
  topics: [
    { name: "Career transition timeline", frequency: 12, enthusiasm: 92, thread: [
      { speaker: "jim", name: "Jim", text: "Let's talk about timing. When are you thinking of making this move?", timestamp: "10:15" },
      { speaker: "mark", name: "Mark", text: "Ideally within the next 6 months. But I'm not sure if that's realistic.", timestamp: "10:32" },
      { speaker: "jim", name: "Jim", text: "What would need to happen for 6 months to feel realistic?", timestamp: "10:48" },
      { speaker: "mark", name: "Mark", text: "I'd need to have the conversation with my manager, line up some opportunities, and feel confident I'm not leaving my team in a lurch.", timestamp: "11:05" },
    ]},
    { name: "Skill gap analysis", frequency: 8, enthusiasm: 68, thread: [
      { speaker: "mark", name: "Mark", text: "I feel like there are gaps in what I know for the roles I'm looking at.", timestamp: "14:22" },
      { speaker: "jim", name: "Jim", text: "What gaps are you most aware of?", timestamp: "14:38" },
      { speaker: "mark", name: "Mark", text: "Definitely the strategic side. I'm strong technically but I haven't led big initiatives.", timestamp: "14:55" },
    ]},
    { name: "Networking strategy", frequency: 6, enthusiasm: 85, thread: [
      { speaker: "jim", name: "Jim", text: "Who in your network might be helpful to reconnect with?", timestamp: "28:10" },
      { speaker: "mark", name: "Mark", text: "There are a few former colleagues who've made similar transitions. I've been hesitant to reach out.", timestamp: "28:28" },
    ]},
    { name: "Financial runway concerns", frequency: 4, enthusiasm: 42, thread: [] },
    { name: "Interview preparation", frequency: 3, enthusiasm: 71, thread: [] },
  ],
  keyQuestions: {
    jim: [
      { text: "What would success look like for you in 6 months?", timestamp: "12:34", resonance: "high",
        threadType: "standard",
        conclusion: { type: "resolved", confidence: "high", text: "Mark defined success as clarity on direction and reduced anxiety", timestamp: "14:20" },
        thread: [
          { speaker: "jim", name: "Jim", text: "What would success look like for you in 6 months?", timestamp: "12:34", confidence: "high" },
          { speaker: "mark", name: "Mark", text: "I think... having clarity on my direction. Not necessarily having made the move yet, but knowing what I'm moving toward.", timestamp: "12:52", confidence: "high" },
          { speaker: "jim", name: "Jim", text: "Clarity on direction. What would that feel like day-to-day?", timestamp: "13:15", confidence: "high" },
          { speaker: "mark", name: "Mark", text: "Less anxiety, probably. Right now I wake up with this weight of indecision. I'd love to wake up feeling purposeful.", timestamp: "13:38", confidence: "high" },
          { speaker: "jim", name: "Jim", text: "That's a really clear picture. Clarity and purpose, less weight. Thank you for naming that. Let's hold onto it.", timestamp: "14:02", confidence: "high" },
          { speaker: "mark", name: "Mark", text: "Yeah, that feels right. That's the target.", timestamp: "14:15", confidence: "high" },
        ]},
      { text: "What's holding you back from starting that conversation with your manager?", timestamp: "18:22", resonance: "high", 
        hasForks: true,
        forks: [
          {
            id: "manager-fear",
            label: "Manager's reaction",
            emoji: "😰",
            summary: "Fear of being seen as uncommitted",
            exchangeCount: 6,
            conclusion: { type: "breakthrough", text: "Realized fear itself is the blocker" },
            thread: [
              { speaker: "jim", name: "Jim", text: "What's holding you back from starting that conversation with your manager?", timestamp: "18:22", confidence: "high" },
              { speaker: "mark", name: "Mark", text: "I guess I'm worried it'll change how she sees me. Like I'm not committed to the team.", timestamp: "18:45", confidence: "high" },
              { speaker: "jim", name: "Jim", text: "Has she ever given you reason to believe she'd react that way?", timestamp: "19:02", confidence: "high" },
              { speaker: "mark", name: "Mark", text: "Not directly, no. But I've seen how she reacted when someone else on the team started interviewing elsewhere.", timestamp: "19:18", confidence: "high" },
              { speaker: "jim", name: "Jim", text: "What happened in that situation?", timestamp: "19:35", confidence: "high" },
              { speaker: "mark", name: "Mark", text: "She kind of pulled back from them. Stopped including them in important projects. It felt like they were written off.", timestamp: "19:48", confidence: "high" },
            ]
          },
          {
            id: "financial",
            label: "Financial runway",
            emoji: "💰",
            summary: "Worry about money if it doesn't work out",
            exchangeCount: 4,
            conclusion: { type: "action_item", text: "Calculate 6-month runway needs" },
            thread: [
              { speaker: "jim", name: "Jim", text: "Is there anything else that's holding you back beyond the manager concern?", timestamp: "20:15", confidence: "high" },
              { speaker: "mark", name: "Mark", text: "Yeah, honestly the money thing too. What if the new role doesn't work out and I've burned the bridge here?", timestamp: "20:32", confidence: "high" },
              { speaker: "jim", name: "Jim", text: "Tell me more about the financial concern.", timestamp: "20:48", confidence: "high" },
              { speaker: "mark", name: "Mark", text: "If I had 6 months of expenses saved up, I'd feel more comfortable taking the risk. Right now I'm not quite there.", timestamp: "21:05", confidence: "high" },
            ]
          },
          {
            id: "clarity",
            label: "Role clarity",
            emoji: "🎯",
            summary: "Unclear what roles would be a good fit",
            exchangeCount: 3,
            conclusion: { type: "unresolved", text: "Touched on but not fully explored" },
            thread: [
              { speaker: "mark", name: "Mark", text: "And honestly, I don't even know what I'd be moving TO. That makes it harder to have the conversation.", timestamp: "22:10", confidence: "high" },
              { speaker: "jim", name: "Jim", text: "So there's some lack of clarity about the destination?", timestamp: "22:25", confidence: "high" },
              { speaker: "mark", name: "Mark", text: "Yeah. I know I want something different, but 'different' isn't specific enough to act on.", timestamp: "22:38", confidence: "medium" },
            ]
          }
        ],
        thread: [
          { speaker: "jim", name: "Jim", text: "What's holding you back from starting that conversation with your manager?", timestamp: "18:22" },
          { speaker: "mark", name: "Mark", text: "I guess I'm worried it'll change how she sees me. Like I'm not committed to the team.", timestamp: "18:45" },
        ]},
      { text: "How might you reframe that fear as an opportunity?", timestamp: "24:15", resonance: "medium", 
        threadType: "interrupted",
        conclusion: { type: "resolved", confidence: "high", text: "Mark reframed fear as a signal he's ready for growth", timestamp: "28:45" },
        thread: [
          { speaker: "jim", name: "Jim", text: "How might you reframe that fear as an opportunity?", timestamp: "24:15", confidence: "high" },
          { speaker: "mark", name: "Mark", text: "Hmm, that's interesting. I guess the fact that I'm scared means I care about growth, right? Like if I was comfortable, maybe I'd be—", timestamp: "24:32", confidence: "high" },
          { speaker: "jim", name: "Jim", text: "Hold that thought — I want to come back to that. Before we run out of time, I wanted to check: are we still good for next Thursday?", timestamp: "24:50", confidence: "high", isInterruption: true },
          { speaker: "mark", name: "Mark", text: "Oh, actually I have a conflict next week. Can we do Wednesday instead?", timestamp: "25:05", confidence: "high", isGap: true },
          { speaker: "jim", name: "Jim", text: "Wednesday at 10 works. I'll send an updated invite.", timestamp: "25:18", confidence: "high", isGap: true },
          { speaker: "jim", name: "Jim", text: "OK, coming back to what you were saying — you said the fear might mean you care about growth.", timestamp: "25:35", confidence: "high", isReturn: true },
          { speaker: "mark", name: "Mark", text: "Yeah. Like, if this didn't scare me, it probably wouldn't matter enough to pursue. The fear is actually a signal, not a stop sign.", timestamp: "25:52", confidence: "high" },
          { speaker: "jim", name: "Jim", text: "I love that reframe. 'The fear is a signal, not a stop sign.' How does it feel to say that?", timestamp: "26:15", confidence: "high" },
          { speaker: "mark", name: "Mark", text: "Actually kind of freeing? Like I've been treating it as a reason to wait, but maybe it's a reason to move.", timestamp: "26:35", confidence: "high" },
        ]},
    ],
    mark: [
      { text: "Should I focus on technical skills or leadership development first?", timestamp: "08:45", resonance: "high", thread: [
        { speaker: "mark", name: "Mark", text: "Should I focus on technical skills or leadership development first?", timestamp: "08:45" },
        { speaker: "jim", name: "Jim", text: "What's drawing you to each of those paths?", timestamp: "09:02" },
      ]},
      { text: "How do I know when I'm ready to make the leap?", timestamp: "31:02", resonance: "high",
        threadType: "standard",
        conclusion: { type: "pivoted", confidence: "low", text: "Conversation shifted to financial concerns before fully resolving", timestamp: "33:40" },
        thread: [
          { speaker: "mark", name: "Mark", text: "How do I know when I'm ready to make the leap?", timestamp: "31:02", confidence: "high" },
          { speaker: "jim", name: "Jim", text: "What would 'ready' look like to you?", timestamp: "31:18", confidence: "high" },
          { speaker: "mark", name: "Mark", text: "I don't know... I keep waiting for this feeling of certainty that never comes.", timestamp: "31:42", confidence: "high" },
          { speaker: "jim", name: "Jim", text: "Has certainty ever come before a big decision in your life?", timestamp: "32:00", confidence: "high" },
          { speaker: "mark", name: "Mark", text: "...No, actually. I usually figure it out as I go. Huh.", timestamp: "32:10", confidence: "high" },
          { speaker: "jim", name: "Jim", text: "So what would happen if you let go of needing to feel ready?", timestamp: "32:30", confidence: "high" },
          { speaker: "mark", name: "Mark", text: "That's terrifying. But also... I guess the other transitions in my career happened that way too. I never felt ready for any of them.", timestamp: "32:55", confidence: "high" },
          { speaker: "mark", name: "Mark", text: "Actually, you know what, the money thing is really what's nagging me. Can we talk about that?", timestamp: "33:25", confidence: "medium" },
        ]},
      { text: "What if the new role doesn't work out?", timestamp: "35:18", resonance: "medium",
        threadType: "standard",
        conclusion: { type: "unresolved", confidence: "high", text: "Mark raised this concern but conversation ended before exploring it", timestamp: "36:10" },
        thread: [
          { speaker: "mark", name: "Mark", text: "What if the new role doesn't work out? Like, what's my fallback?", timestamp: "35:18", confidence: "high" },
          { speaker: "jim", name: "Jim", text: "That's a really important question. What scenarios are you imagining?", timestamp: "35:35", confidence: "high" },
          { speaker: "mark", name: "Mark", text: "Like, I leave for a startup and it folds in 6 months. Or the culture is terrible and I'm stuck.", timestamp: "35:52", confidence: "high" },
          { speaker: "jim", name: "Jim", text: "Those are real risks. We should dig into those next time — I want to give them the time they deserve. We're coming up on the hour.", timestamp: "36:10", confidence: "high" },
        ]},
    ]
  },
  keyInsights: [
    { text: "The fear of being seen as uncommitted might actually be preventing growth opportunities", speaker: "Mark", timestamp: "19:45", resonance: "breakthrough", suggestedQuestions: [
      "What would change if you let go of needing to appear committed at all costs?",
    ]},
    { text: "Previous transitions happened without feeling 'ready' — readiness came through action", speaker: "Mark", timestamp: "32:28", resonance: "breakthrough", suggestedQuestions: [
      "What would it look like to act before you feel ready in this situation?",
    ]},
    { text: "Manager might be an ally rather than an obstacle in career development", speaker: "Mark", timestamp: "25:30", resonance: "high", suggestedQuestions: [
      "What's the smallest step you could take to explore her as an ally?",
    ]},
  ],
  detectedActions: [
    { text: "Have an exploratory conversation with manager about career goals", owner: "Mark", dueDate: "2 weeks", timestamp: "41:22" },
    { text: "Draft a list of 3 potential roles that align with long-term vision", owner: "Mark", dueDate: "Next session", timestamp: "38:15" },
    { text: "Send Mark the article on managing career transitions", owner: "Jim", dueDate: "This week", timestamp: "44:02" },
  ],
  detectedAgreements: [
    { text: "We'll focus the next session on preparing for the manager conversation", timestamp: "42:30" },
    { text: "Mark will come prepared with questions he wants to ask his manager", timestamp: "43:15" },
  ],
  detectedFrustrations: [
    { text: "I feel stuck in this loop of wanting to move forward but not knowing how", speaker: "Mark", timestamp: "16:42" },
    { text: "It's frustrating that I've been thinking about this for months and still haven't taken any real action", speaker: "Mark", timestamp: "22:18" },
  ],
  detectedBlockers: [
    { 
      text: "Fear of being seen as uncommitted by my manager", 
      speaker: "Mark", 
      timestamp: "19:05",
      unblockingNeeds: [
        { text: "I'd need to know that having this conversation won't hurt my standing on the team", timestamp: "19:22" },
        { text: "If she could see it as me being proactive about my growth rather than disloyal", timestamp: "25:15" },
        { text: "Maybe if I framed it as wanting her input on my development path", timestamp: "25:48" },
      ],
      suggestedQuestions: [
        "What evidence would help you feel confident that raising career goals with your manager is safe?",
      ]
    },
    { 
      text: "Unclear on what roles would actually be a good fit", 
      speaker: "Mark", 
      timestamp: "26:33",
      unblockingNeeds: [
        { text: "I need to do more research on what's actually out there", timestamp: "27:05" },
        { text: "Talking to people who've made similar transitions would help", timestamp: "28:42" },
        { text: "Maybe I should make a list of my non-negotiables for a new role", timestamp: "29:15" },
      ],
      suggestedQuestions: [
        "What would your non-negotiables list look like if you drafted it right now?",
      ]
    },
    { 
      text: "Limited financial runway if the transition doesn't work out", 
      speaker: "Mark", 
      timestamp: "20:48",
      unblockingNeeds: [
        { text: "If I had 6 months of expenses saved up, I'd feel more comfortable taking the risk", timestamp: "21:10" },
        { text: "Or if the new role had a guaranteed trial period with severance", timestamp: "21:35" },
      ],
      suggestedQuestions: [
        "What's a realistic timeline to build that 6-month runway, and what would you need to change?",
      ]
    },
  ],
  transcriptExcerpts: [
    { speaker: "jim", name: "Jim", text: "Good morning Mark! How are you feeling going into today's session?", timestamp: "0:00" },
    { speaker: "mark", name: "Mark", text: "Morning! A bit nervous actually. I've been thinking a lot about what we discussed last time.", timestamp: "0:15" },
    { speaker: "jim", name: "Jim", text: "Tell me more about that. What's been on your mind?", timestamp: "0:32" },
    { speaker: "mark", name: "Mark", text: "Mainly the timeline question. I keep going back and forth on whether 6 months is realistic.", timestamp: "0:45" },
    { speaker: "jim", name: "Jim", text: "What makes you feel like it might not be realistic?", timestamp: "1:02" },
    { speaker: "mark", name: "Mark", text: "I guess I'm worried about what my manager will think. Like, if I start having these conversations about career growth, she might see me as not committed to the team.", timestamp: "1:18" },
    { speaker: "jim", name: "Jim", text: "That's an interesting fear. Has she ever given you reason to believe she'd react that way?", timestamp: "1:45" },
    { speaker: "mark", name: "Mark", text: "Not directly, no. But I've seen how she reacted when someone else on the team started interviewing elsewhere. It wasn't great.", timestamp: "2:03" },
    { speaker: "jim", name: "Jim", text: "What happened in that situation?", timestamp: "2:28" },
    { speaker: "mark", name: "Mark", text: "She kind of pulled back from them. Stopped including them in important projects. It felt like they were written off before they even left.", timestamp: "2:41" },
    { speaker: "jim", name: "Jim", text: "And you're worried the same thing could happen to you if you're transparent about exploring options?", timestamp: "3:15" },
    { speaker: "mark", name: "Mark", text: "Exactly. But at the same time, I feel stuck not talking about it. Like I'm pretending everything is fine when it's not.", timestamp: "3:32" },
    { speaker: "jim", name: "Jim", text: "It sounds like you're caught between two fears — the fear of being seen as uncommitted, and the fear of staying stuck. Which one feels heavier right now?", timestamp: "4:01" },
    { speaker: "mark", name: "Mark", text: "Honestly? Staying stuck. I've been in this loop for months and it's exhausting.", timestamp: "4:28" },
  ],
};

// Utility Components
const EnthusiasmIndicator = ({ level }) => {
  const getLabel = () => level >= 80 ? 'Resonates' : level >= 60 ? 'Neutral' : "Doesn't resonate";
  const getColor = () => level >= 80 ? 'bg-emerald-500' : level >= 60 ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${getColor()} rounded-full`} style={{ width: `${level}%` }} />
      </div>
      <span className="text-xs text-slate-500">{getLabel()}</span>
    </div>
  );
};

const ResonanceBadge = ({ level }) => {
  const styles = { breakthrough: 'bg-purple-100 text-purple-700', high: 'bg-emerald-100 text-emerald-700', medium: 'bg-slate-100 text-slate-600' };
  const labels = { breakthrough: '✨ Breakthrough', high: 'High resonance', medium: 'Moderate' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[level]}`}>{labels[level]}</span>;
};

const FocusScoreRing = ({ score }) => {
  const radius = 42, circumference = 2 * Math.PI * radius, offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#6b7280';
  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28 flex-shrink-0">
      <svg className="w-28 h-28 -rotate-90">
        <circle cx="56" cy="56" r={radius} stroke="#e5e7eb" strokeWidth="8" fill="none" />
        <circle cx="56" cy="56" r={radius} stroke={color} strokeWidth="8" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-slate-800">{score}%</span>
        <span className="text-xs text-slate-500">focused</span>
      </div>
    </div>
  );
};

const AddToSessionButton = ({ sessions, onAdd, isAdded, addedToSession }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (isAdded) {
    return (
      <span className="px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 rounded flex items-center gap-1 whitespace-nowrap">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        {addedToSession}
      </span>
    );
  }
  return (
    <div className="relative" style={{ zIndex: isOpen ? 9999 : 'auto' }}>
      <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors flex items-center gap-1">
        + Add to session
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} 
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} 
          />
          <div 
            style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 9999, minWidth: 192 }}
            className="bg-white rounded-lg shadow-xl border border-slate-200 py-1"
          >
            <p className="px-3 py-1.5 text-xs font-medium text-slate-500 border-b border-slate-100">Add to upcoming session</p>
            {sessions.map((session) => (
              <button key={session.id} onClick={(e) => { e.stopPropagation(); onAdd(session); setIsOpen(false); }} className="w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors flex items-center justify-between">
                <div><p className="text-sm font-medium text-slate-800">{session.date}</p><p className="text-xs text-slate-500">{session.time}</p></div>
                {session.label && <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{session.label}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const TimeSpentWithChart = ({ timeSpent, itemName, allTopics, totalDuration }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Calculate percentages for pie chart
  const percentage = Math.round((timeSpent / totalDuration) * 100);
  const otherTopics = allTopics.filter(t => t.name !== itemName);
  
  // Build pie chart segments
  const segments = [];
  let currentAngle = 0;
  
  // Add current topic first (highlighted)
  const currentTopicAngle = (timeSpent / totalDuration) * 360;
  segments.push({
    name: itemName,
    angle: currentTopicAngle,
    startAngle: currentAngle,
    percentage: percentage,
    isHighlighted: true
  });
  currentAngle += currentTopicAngle;
  
  // Add other topics
  otherTopics.forEach(topic => {
    const angle = (topic.timeSpent / totalDuration) * 360;
    segments.push({
      name: topic.name,
      angle: angle,
      startAngle: currentAngle,
      percentage: Math.round((topic.timeSpent / totalDuration) * 100),
      isHighlighted: false
    });
    currentAngle += angle;
  });
  
  // SVG pie chart helper
  const describeArc = (startAngle, endAngle, radius = 40) => {
    const start = polarToCartesian(50, 50, radius, endAngle);
    const end = polarToCartesian(50, 50, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M 50 50 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  };
  
  const polarToCartesian = (cx, cy, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: cx + (radius * Math.cos(angleInRadians)),
      y: cy + (radius * Math.sin(angleInRadians))
    };
  };
  
  const colors = [
    '#6366f1', // indigo - highlighted
    '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b'
  ];
  
  return (
    <div 
      className="relative flex items-center gap-1.5 cursor-default"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-xs font-medium text-slate-600">{timeSpent}m</span>
      
      {isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30">
          <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3 min-w-48">
            <div className="flex items-center gap-3">
              <svg width="80" height="80" viewBox="0 0 100 100" className="flex-shrink-0">
                {segments.map((seg, i) => (
                  <path
                    key={i}
                    d={describeArc(seg.startAngle, seg.startAngle + seg.angle)}
                    fill={seg.isHighlighted ? colors[0] : colors[Math.min(i, colors.length - 1)]}
                    stroke="white"
                    strokeWidth="1"
                  />
                ))}
                <circle cx="50" cy="50" r="20" fill="white" />
                <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="text-sm font-bold fill-slate-800" fontSize="14">{percentage}%</text>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate mb-1">{itemName}</p>
                <p className="text-xs text-slate-500">{timeSpent}m of {totalDuration}m total</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  <span className="text-xs text-slate-600">This topic</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                  <span className="text-xs text-slate-600">Other topics</span>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white border-r border-b border-slate-200 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

// Card Components
const TopicCard = ({ topic, rank, onClick }) => (
  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer group" onClick={onClick}>
    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center"><span className="text-xs font-semibold text-slate-600">{rank}</span></div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-slate-800 truncate">{topic.name}</p>
      <p className="text-xs text-slate-500">{topic.frequency} mentions <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">· View conversation →</span></p>
    </div>
    <div className="flex flex-col items-end gap-1"><EnthusiasmIndicator level={topic.enthusiasm} /></div>
  </div>
);

const QuestionCard = ({ question, onClick }) => (
  <div className="p-3 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer" onClick={onClick}>
    <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-slate-500">{question.timestamp}</span><ResonanceBadge level={question.resonance} /></div>
    <p className="text-sm text-slate-700">"{question.text}"</p>
    <p className="text-xs text-indigo-600 mt-2">View conversation →</p>
  </div>
);

const InsightCard = ({ insight }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasQuestions = insight.suggestedQuestions?.length > 0;
  return (
    <div 
      className={`p-3 rounded-lg border transition-all ${insight.resonance === 'breakthrough' ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'} ${hasQuestions ? 'cursor-pointer hover:border-purple-300' : ''} ${isExpanded ? 'ring-2 ring-purple-300' : ''}`}
      onClick={() => hasQuestions && setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-slate-500">{insight.speaker} • {insight.timestamp}</span>
        <div className="flex items-center gap-2">
          <ResonanceBadge level={insight.resonance} />
          {hasQuestions && (
            <svg className={`w-3.5 h-3.5 text-purple-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-700">{insight.text}</p>
      {isExpanded && hasQuestions && (
        <div className="mt-3 pt-3 border-t border-purple-200">
          <p className="text-xs font-medium text-indigo-700 mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Deepening question:
            <span className="px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-600 rounded">AI Coach</span>
          </p>
          <div className="space-y-2">
            {insight.suggestedQuestions.map((question, i) => (
              <div key={i} className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                <p className="text-sm text-slate-700">"{question}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DetectedActionCard = ({ action, onAdd, isAdded }) => (
  <div className="p-4 bg-white rounded-lg border border-slate-200">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <p className="text-sm text-slate-800 mb-2">{action.text}</p>
        <div className="flex items-center gap-3 text-xs text-slate-500"><span className="font-medium">{action.owner}</span><span>•</span><span>{action.dueDate}</span><span>•</span><span>{action.timestamp}</span></div>
      </div>
      {isAdded ? (
        <span className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Added</span>
      ) : (
        <button onClick={onAdd} className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">+ Add to Actions</button>
      )}
    </div>
  </div>
);

const DetectedAgreementCard = ({ agreement, onAdd, isAdded }) => (
  <div className="p-4 bg-white rounded-lg border border-slate-200">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1"><p className="text-sm text-slate-800 mb-2">{agreement.text}</p><div className="text-xs text-slate-500">{agreement.timestamp}</div></div>
      {isAdded ? (
        <span className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Added</span>
      ) : (
        <button onClick={onAdd} className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">+ Add to Agreements</button>
      )}
    </div>
  </div>
);

const DetectedFrustrationCard = ({ frustration }) => (
  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3.5 h-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <div className="flex-1">
        <p className="text-sm text-slate-800 mb-2">"{frustration.text}"</p>
        <div className="flex items-center gap-3 text-xs text-slate-500"><span className="font-medium">{frustration.speaker}</span><span>•</span><span>{frustration.timestamp}</span></div>
      </div>
    </div>
  </div>
);

const DetectedBlockerCard = ({ blocker }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasExpandableContent = blocker.unblockingNeeds?.length > 0 || blocker.suggestedQuestions?.length > 0;
  return (
    <div className={`p-4 bg-red-50 rounded-lg border border-red-200 cursor-pointer transition-all ${isExpanded ? 'ring-2 ring-red-300' : 'hover:border-red-300'}`} onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}>
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-800 mb-2">{blocker.text}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-slate-500"><span className="font-medium">{blocker.speaker}</span><span>•</span><span>{blocker.timestamp}</span></div>
            {hasExpandableContent && (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <span>{isExpanded ? 'Hide details' : 'View details'}</span>
                <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            )}
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-red-200 space-y-4">
          {blocker.unblockingNeeds?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-700 mb-3 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                What {blocker.speaker} said they'd need to get unblocked:
              </p>
              <div className="space-y-2">
                {blocker.unblockingNeeds.map((need, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-white rounded-lg border border-red-100">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div className="flex-1"><p className="text-sm text-slate-700">"{need.text}"</p><span className="text-xs text-slate-400">{need.timestamp}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {blocker.suggestedQuestions?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-indigo-700 mb-3 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Suggested followup question:
                <span className="px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-600 rounded">AI Coach</span>
              </p>
              <div className="space-y-2">
                {blocker.suggestedQuestions.map((question, i) => (
                  <div key={i} className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                    <p className="text-sm text-slate-700">"{question}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Drawer Components
const ThreadDrawer = ({ question, onClose, isJim }) => {
  const [selectedFork, setSelectedFork] = useState(null);
  
  if (!question) return null;
  
  const getConclusionStyle = (type) => {
    switch (type) {
      case 'breakthrough': return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: '✨' };
      case 'action_item': return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: '✓' };
      case 'resolved': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: '●' };
      case 'unresolved': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: '◐' };
      case 'pivoted': return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', icon: '↪' };
      default: return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', icon: '○' };
    }
  };
  
  // If viewing a specific fork's thread
  if (selectedFork) {
    const fork = question.forks.find(f => f.id === selectedFork);
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedFork(null)} className="p-1 hover:bg-slate-100 rounded transition-colors">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <span>{fork.emoji}</span> {fork.label}
                </h3>
                <p className="text-xs text-slate-500">{fork.exchangeCount} exchanges</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {fork.thread.map((msg, i) => (
              <div key={i} className={`flex ${msg.speaker === 'jim' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] ${msg.confidence === 'medium' ? 'opacity-75' : ''}`}>
                  <div className={`flex items-center gap-2 mb-1 ${msg.speaker === 'jim' ? '' : 'justify-end'}`}>
                    {msg.speaker === 'jim' && <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"><span className="text-xs text-white">J</span></div>}
                    <span className="text-xs text-slate-500">{msg.name} • {msg.timestamp}</span>
                    {msg.speaker !== 'jim' && <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><span className="text-xs text-white">M</span></div>}
                  </div>
                  <div className={`px-3 py-2 rounded-2xl ${msg.speaker === 'jim' ? 'bg-slate-200 text-slate-800 rounded-tl-sm' : 'bg-indigo-500 text-white rounded-tr-sm'} ${msg.confidence === 'medium' ? 'border-2 border-dashed border-slate-300' : ''}`}>
                    <p className="text-sm">{msg.text}</p>
                  </div>
                  {msg.confidence === 'medium' && (
                    <p className="text-xs text-slate-400 mt-1 italic">May be tangentially related</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Conclusion */}
          <div className={`p-4 border-t ${getConclusionStyle(fork.conclusion.type).border} ${getConclusionStyle(fork.conclusion.type).bg}`}>
            <div className="flex items-start gap-2">
              <span className="text-lg">{getConclusionStyle(fork.conclusion.type).icon}</span>
              <div>
                <p className={`text-sm font-medium ${getConclusionStyle(fork.conclusion.type).text}`}>
                  {fork.conclusion.type === 'breakthrough' && 'Breakthrough moment'}
                  {fork.conclusion.type === 'action_item' && 'Led to action item'}
                  {fork.conclusion.type === 'resolved' && 'Thread resolved'}
                  {fork.conclusion.type === 'unresolved' && 'Thread unresolved'}
                </p>
                <p className="text-sm text-slate-600 mt-1">{fork.conclusion.text}</p>
                {fork.conclusion.type === 'unresolved' && (
                  <button className="mt-2 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                    + Add to next session agenda
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Thread map view (for questions with forks)
  if (question.hasForks) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div><h3 className="font-semibold text-slate-800">Thread Map</h3><p className="text-xs text-slate-500">{question.timestamp}</p></div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          
          {/* Anchor question */}
          <div className="p-4 bg-indigo-50 border-b border-indigo-100">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-full ${isJim ? 'bg-indigo-500' : 'bg-emerald-500'} flex items-center justify-center`}><span className="text-xs text-white">{isJim ? 'J' : 'M'}</span></div>
              <span className="text-sm font-medium text-slate-700">{isJim ? 'Jim Hodapp' : 'Mark Richardson'}</span>
              <ResonanceBadge level={question.resonance} />
            </div>
            <p className="text-sm text-slate-800 font-medium">"{question.text}"</p>
          </div>
          
          {/* Thread map visualization */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">This question led to {question.forks.length} threads</p>
            
            {/* Visual tree */}
            <div className="relative pl-6">
              {/* Vertical connector line */}
              <div className="absolute left-3 top-0 bottom-4 w-0.5 bg-slate-300" />
              
              {question.forks.map((fork, i) => (
                <div key={fork.id} className="relative mb-4 last:mb-0">
                  {/* Horizontal connector */}
                  <div className="absolute left-[-12px] top-6 w-3 h-0.5 bg-slate-300" />
                  
                  {/* Fork card */}
                  <button
                    onClick={() => setSelectedFork(fork.id)}
                    className="w-full text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">
                        {fork.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-semibold text-slate-800">{fork.label}</h4>
                          <span className="text-xs text-slate-400">{fork.exchangeCount} exchanges</span>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{fork.summary}</p>
                        
                        {/* Conclusion badge */}
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getConclusionStyle(fork.conclusion.type).bg} ${getConclusionStyle(fork.conclusion.type).text}`}>
                          <span>{getConclusionStyle(fork.conclusion.type).icon}</span>
                          {fork.conclusion.type === 'breakthrough' && 'Breakthrough'}
                          {fork.conclusion.type === 'action_item' && 'Action item'}
                          {fork.conclusion.type === 'resolved' && 'Resolved'}
                          {fork.conclusion.type === 'unresolved' && 'Unresolved'}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                </div>
              ))}
            </div>
            
            {/* Timeline visualization */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Timeline</p>
              <div className="relative h-8 bg-slate-200 rounded-full overflow-hidden">
                {question.forks.map((fork, i) => {
                  const colors = ['bg-indigo-400', 'bg-emerald-400', 'bg-amber-400'];
                  const widths = [35, 25, 20]; // Approximate percentages
                  const lefts = [0, 38, 66];
                  return (
                    <div
                      key={fork.id}
                      className={`absolute top-0 h-full ${colors[i]} cursor-pointer hover:brightness-110 transition-all`}
                      style={{ left: `${lefts[i]}%`, width: `${widths[i]}%` }}
                      title={`${fork.label}: ${fork.exchangeCount} exchanges`}
                      onClick={() => setSelectedFork(fork.id)}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-400">
                <span>18:22</span>
                <span>23:00</span>
              </div>
              <div className="flex gap-4 mt-3">
                {question.forks.map((fork, i) => {
                  const colors = ['bg-indigo-400', 'bg-emerald-400', 'bg-amber-400'];
                  return (
                    <div key={fork.id} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${colors[i]}`} />
                      <span className="text-xs text-slate-500">{fork.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Default single-thread view (with interruptions, conclusions, confidence)
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div><h3 className="font-semibold text-slate-800">Question Thread</h3><p className="text-xs text-slate-500">{question.timestamp}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-4 bg-indigo-50 border-b border-indigo-100">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-6 h-6 rounded-full ${isJim ? 'bg-indigo-500' : 'bg-emerald-500'} flex items-center justify-center`}><span className="text-xs text-white">{isJim ? 'J' : 'M'}</span></div>
            <span className="text-sm font-medium text-slate-700">{isJim ? 'Jim Hodapp' : 'Mark Richardson'}</span>
            <ResonanceBadge level={question.resonance} />
          </div>
          <p className="text-sm text-slate-800 font-medium">"{question.text}"</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {question.thread?.map((msg, i) => {
            const prevMsg = i > 0 ? question.thread[i - 1] : null;
            const showGapStart = msg.isInterruption || (msg.isGap && !prevMsg?.isGap && !prevMsg?.isInterruption);
            const showReturnMarker = msg.isReturn;
            const isInGap = msg.isGap || msg.isInterruption;
            
            return (
              <Fragment key={i}>
                {/* Gap start divider */}
                {showGapStart && (
                  <div className="flex items-center gap-2 py-2">
                    <div className="flex-1 border-t border-dashed border-amber-300" />
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" /></svg>
                      Thread interrupted
                    </span>
                    <div className="flex-1 border-t border-dashed border-amber-300" />
                  </div>
                )}
                
                {/* Return marker */}
                {showReturnMarker && (
                  <div className="flex items-center gap-2 py-2">
                    <div className="flex-1 border-t border-dashed border-emerald-300" />
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" /></svg>
                      Thread resumed
                    </span>
                    <div className="flex-1 border-t border-dashed border-emerald-300" />
                  </div>
                )}
                
                <div className={`flex ${msg.speaker === 'jim' ? 'justify-start' : 'justify-end'} ${isInGap ? 'opacity-40' : ''}`}>
                  <div className={`max-w-[85%] ${msg.confidence === 'medium' ? 'opacity-75' : ''}`}>
                    <div className={`flex items-center gap-2 mb-1 ${msg.speaker === 'jim' ? '' : 'justify-end'}`}>
                      {msg.speaker === 'jim' && <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"><span className="text-xs text-white">J</span></div>}
                      <span className="text-xs text-slate-500">{msg.name} • {msg.timestamp}</span>
                      {msg.speaker !== 'jim' && <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><span className="text-xs text-white">M</span></div>}
                    </div>
                    <div className={`px-3 py-2 rounded-2xl ${
                      isInGap 
                        ? 'bg-slate-100 text-slate-500 border border-dashed border-slate-300' 
                        : msg.speaker === 'jim' 
                          ? 'bg-slate-200 text-slate-800 rounded-tl-sm' 
                          : 'bg-indigo-500 text-white rounded-tr-sm'
                    } ${msg.confidence === 'medium' ? 'border-2 border-dashed border-slate-300' : ''}`}>
                      <p className="text-sm">{msg.text}</p>
                    </div>
                    {isInGap && (
                      <p className="text-xs text-slate-400 mt-1 italic">Off-topic — scheduling</p>
                    )}
                    {msg.confidence === 'medium' && !isInGap && (
                      <p className="text-xs text-slate-400 mt-1 italic">May be tangentially related</p>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
        
        {/* Thread conclusion panel */}
        {question.conclusion && (
          <div className={`p-4 border-t ${getConclusionStyle(question.conclusion.type).border} ${getConclusionStyle(question.conclusion.type).bg}`}>
            <div className="flex items-start gap-2">
              <span className="text-lg">{getConclusionStyle(question.conclusion.type).icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${getConclusionStyle(question.conclusion.type).text}`}>
                    {question.conclusion.type === 'breakthrough' && 'Breakthrough moment'}
                    {question.conclusion.type === 'action_item' && 'Led to action item'}
                    {question.conclusion.type === 'resolved' && 'Thread resolved'}
                    {question.conclusion.type === 'unresolved' && 'Thread unresolved'}
                    {question.conclusion.type === 'pivoted' && 'Thread pivoted'}
                  </p>
                  {/* Confidence indicator */}
                  {question.conclusion.confidence && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      question.conclusion.confidence === 'high' 
                        ? 'bg-white/60 text-slate-600' 
                        : 'bg-white/60 text-amber-600 border border-amber-200'
                    }`}>
                      {question.conclusion.confidence === 'high' ? '● Clear ending' : '◐ Fuzzy ending'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1">{question.conclusion.text}</p>
                {question.conclusion.timestamp && (
                  <p className="text-xs text-slate-400 mt-1">at {question.conclusion.timestamp}</p>
                )}
                {question.conclusion.type === 'unresolved' && (
                  <button className="mt-2 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200">
                    + Add to next session agenda
                  </button>
                )}
                {question.conclusion.type === 'pivoted' && (
                  <div className="mt-2 flex gap-2">
                    <button className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200">
                      + Add to next session agenda
                    </button>
                    <span className="text-xs text-slate-400 self-center">Revisit this thread?</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TopicThreadDrawer = ({ topic, onClose }) => {
  if (!topic) return null;
  const getResonanceLabel = (level) => level >= 80 ? 'Resonates' : level >= 60 ? 'Neutral' : "Doesn't resonate";
  const getResonanceColor = (level) => level >= 80 ? 'bg-emerald-100 text-emerald-700' : level >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div><h3 className="font-semibold text-slate-800">Topic Thread</h3><p className="text-xs text-slate-500">{topic.frequency} mentions in session</p></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-4 bg-slate-100 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2"><h4 className="text-base font-semibold text-slate-800">{topic.name}</h4><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getResonanceColor(topic.enthusiasm)}`}>{getResonanceLabel(topic.enthusiasm)}</span></div>
          <p className="text-xs text-slate-500">Sample conversation from this topic</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {topic.thread?.map((msg, i) => (
            <div key={i} className={`flex ${msg.speaker === 'jim' ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[85%]">
                <div className={`flex items-center gap-2 mb-1 ${msg.speaker === 'jim' ? '' : 'justify-end'}`}>
                  {msg.speaker === 'jim' && <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"><span className="text-xs text-white">J</span></div>}
                  <span className="text-xs text-slate-500">{msg.name} • {msg.timestamp}</span>
                  {msg.speaker !== 'jim' && <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><span className="text-xs text-white">M</span></div>}
                </div>
                <div className={`px-3 py-2 rounded-2xl ${msg.speaker === 'jim' ? 'bg-slate-200 text-slate-800 rounded-tl-sm' : 'bg-indigo-500 text-white rounded-tr-sm'}`}><p className="text-sm">{msg.text}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TranscriptMessage = ({ message, isCoach, onContinue, isContinued, sessions, addedToSession }) => (
  <div className={`flex ${isCoach ? 'justify-start' : 'justify-end'} group`}>
    <div className="max-w-[80%]">
      <div className={`flex items-center gap-2 mb-1 ${isCoach ? '' : 'justify-end'}`}>
        {isCoach && <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center"><span className="text-xs text-white">{message.name[0]}</span></div>}
        <span className="text-xs text-slate-500">{message.name} • {message.timestamp}</span>
        {!isCoach && <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><span className="text-xs text-white">{message.name[0]}</span></div>}
      </div>
      <div className="relative">
        <div className={`px-3 py-2 rounded-2xl ${isCoach ? 'bg-slate-200 text-slate-800 rounded-tl-sm' : 'bg-indigo-500 text-white rounded-tr-sm'}`}><p className="text-sm">{message.text}</p></div>
        <div className={`absolute top-1/2 -translate-y-1/2 ${isCoach ? '-right-2 translate-x-full' : '-left-2 -translate-x-full'} opacity-0 group-hover:opacity-100 transition-opacity`}>
          <AddToSessionButton sessions={sessions} onAdd={onContinue} isAdded={isContinued} addedToSession={addedToSession} />
        </div>
      </div>
    </div>
  </div>
);

// Main Component
export default function InsightsTab() {
  const [activeTab, setActiveTab] = useState('overview');
  const [mainTab, setMainTab] = useState('debrief');
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [isQuestionFromJim, setIsQuestionFromJim] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [addedActions, setAddedActions] = useState({});
  const [addedAgreements, setAddedAgreements] = useState({});
  const [addedToSession, setAddedToSession] = useState({});
  const [continuedTranscriptMessages, setContinuedTranscriptMessages] = useState({});
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const insights = mockInsights;

  const handleQuestionClick = (question, isJim) => { setSelectedQuestion(question); setIsQuestionFromJim(isJim); };
  const closeDrawer = () => setSelectedQuestion(null);
  const handleTopicClick = (topic) => setSelectedTopic(topic);
  const closeTopicDrawer = () => setSelectedTopic(null);
  const handleAddAction = (index) => setAddedActions(prev => ({ ...prev, [index]: true }));
  const handleAddAgreement = (index) => setAddedAgreements(prev => ({ ...prev, [index]: true }));
  const handleAddToSession = (key, session) => setAddedToSession(prev => ({ ...prev, [key]: session.date }));
  const handleContinueTranscript = (index, session) => setContinuedTranscriptMessages(prev => ({ ...prev, [index]: session.date }));

  return (
    <div className="max-w-4xl mx-auto bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-sm font-medium text-slate-700">Jim Hodapp</span></div>
          <span className="text-slate-400">/</span>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-sm font-medium text-slate-700">Mark Richardson</span></div>
          <span className="ml-auto text-xs text-slate-500">Feb 1, 2026 • 9:30 AM</span>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-xs text-slate-600">Goal: </span>
          <span className="text-xs text-indigo-600">Articulate a clear new client relationship development strategy</span>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-white border-b border-slate-200 px-4">
        <div className="flex gap-1 overflow-x-auto">
          {['Notes', 'Agreements', 'Actions', 'Debrief'].map(tab => (
            <button key={tab} onClick={() => setMainTab(tab.toLowerCase())} className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${mainTab === tab.toLowerCase() ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{tab}</button>
          ))}
        </div>
      </div>

      {mainTab === 'debrief' && (
        <div className="px-4 py-4">
          {/* Sub Tabs */}
          <div className="flex gap-1 p-1 bg-white rounded-lg border border-slate-200 mb-4 overflow-x-auto">
            {['overview', 'questions', 'insights', 'transcript'].map(section => (
              <button key={section} onClick={() => setActiveTab(section)} className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize whitespace-nowrap ${activeTab === section ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{section}</button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Session Summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start gap-6">
                  <FocusScoreRing score={insights.focusScore} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1"><h3 className="text-base font-semibold text-slate-800">Session Summary</h3><span className="text-xs text-slate-500">{insights.sessionDate}</span></div>
                    <div className="flex items-center gap-4 text-sm mb-3">
                      <span className="text-slate-600"><span className="font-semibold text-slate-800">{insights.sessionDuration.total}m</span> total</span>
                      <span className="text-emerald-600"><span className="font-semibold">{insights.sessionDuration.focused}m</span> focused</span>
                      <span className="text-slate-400"><span className="font-semibold">{insights.sessionDuration.unfocused}m</span> off-topic</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(insights.sessionDuration.focused / insights.sessionDuration.total) * 100}%` }} /></div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200"><p className="text-xs text-slate-500 mb-0.5">Session Goal</p><p className="text-sm font-medium text-slate-700">"{insights.sessionGoal}"</p></div>
                  </div>
                </div>
              </div>
              
              {/* Stats Grid Row 1 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0"><svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg></div><div><p className="text-xl font-bold text-slate-800">{insights.topics.length}</p><p className="text-xs text-slate-500">Topics Discussed</p></div></div></div>
                <div className="bg-white rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0"><svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><div><p className="text-xl font-bold text-slate-800">{insights.keyQuestions.jim.length + insights.keyQuestions.mark.length}</p><p className="text-xs text-slate-500">Questions Asked</p></div></div></div>
                <div className="bg-white rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0"><svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg></div><div><p className="text-xl font-bold text-slate-800">{insights.keyInsights.length}</p><p className="text-xs text-slate-500">Insights Surfaced</p></div></div></div>
                <div className="bg-white rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0"><svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg></div><div><p className="text-xl font-bold text-slate-800">{insights.detectedAgreements.length}</p><p className="text-xs text-slate-500">Agreements Made</p></div></div></div>
              </div>
              {/* Stats Grid Row 2 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0"><svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg></div><div><p className="text-xl font-bold text-slate-800">{insights.detectedActions.length}</p><p className="text-xs text-slate-500">Actions Identified</p></div></div></div>
                <div className="bg-white rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0"><svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div><div><p className="text-xl font-bold text-slate-800">{insights.detectedBlockers.length}</p><p className="text-xs text-slate-500">Blockers Detected</p></div></div></div>
                <div className="bg-white rounded-xl border border-slate-200 p-3 opacity-0 pointer-events-none" />
                <div className="bg-white rounded-xl border border-slate-200 p-3 opacity-0 pointer-events-none" />
              </div>

              {/* Topics Covered */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-800 mb-1">Topics Covered</h3>
                <p className="text-xs text-slate-500 mb-4">Breakdown of session content by category</p>
                
                {/* Combine all topics for pie chart calculation */}
                {(() => {
                  const allTopicsForChart = [
                    ...insights.goalsDiscussed.filter(g => g.discussed).map(g => ({ name: g.name, timeSpent: g.timeSpent })),
                    ...insights.agendaItems.filter(a => a.discussed).map(a => ({ name: a.name, timeSpent: a.timeSpent })),
                    ...insights.generalThemes.map(t => ({ name: t.name, timeSpent: t.timeSpent })),
                  ];
                  const totalDiscussedTime = allTopicsForChart.reduce((sum, t) => sum + t.timeSpent, 0);
                  
                  return (
                    <>
                {/* Goals Discussed */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h4 className="text-sm font-medium text-slate-700">Goals Discussed</h4>
                    <span className="text-xs text-slate-400">Progress on stated objectives</span>
                  </div>
                  <div className="space-y-2 pl-7">
                    {insights.goalsDiscussed.map((item, i) => (
                      <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${item.discussed ? 'bg-slate-50' : 'bg-amber-50 border border-amber-200'}`}>
                        <div className="flex-1 min-w-0"><p className={`text-sm ${item.discussed ? 'text-slate-800' : 'text-amber-800'}`}>{item.name}</p></div>
                        {item.discussed ? (
                          <div className="flex items-center gap-2">
                            <TimeSpentWithChart timeSpent={item.timeSpent} itemName={item.name} allTopics={allTopicsForChart} totalDuration={totalDiscussedTime} />
                            <AddToSessionButton sessions={insights.upcomingSessions} onAdd={(session) => handleAddToSession(`goal-${i}`, session)} isAdded={!!addedToSession[`goal-${i}`]} addedToSession={addedToSession[`goal-${i}`]} />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-amber-600 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>Not discussed</span>
                            <AddToSessionButton sessions={insights.upcomingSessions} onAdd={(session) => handleAddToSession(`goal-${i}`, session)} isAdded={!!addedToSession[`goal-${i}`]} addedToSession={addedToSession[`goal-${i}`]} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Planned Agenda Items */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded bg-violet-100 flex items-center justify-center">
                      <svg className="w-3 h-3 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <h4 className="text-sm font-medium text-slate-700">Planned Agenda Items</h4>
                    <span className="text-xs text-slate-400">Pre-set topics for this session</span>
                  </div>
                  <div className="space-y-2 pl-7">
                    {insights.agendaItems.map((item, i) => (
                      <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${item.discussed ? 'bg-slate-50' : 'bg-amber-50 border border-amber-200'}`}>
                        <div className="flex-1 min-w-0"><p className={`text-sm ${item.discussed ? 'text-slate-800' : 'text-amber-800'}`}>{item.name}</p></div>
                        {item.discussed ? (
                          <div className="flex items-center gap-2">
                            <TimeSpentWithChart timeSpent={item.timeSpent} itemName={item.name} allTopics={allTopicsForChart} totalDuration={totalDiscussedTime} />
                            <AddToSessionButton sessions={insights.upcomingSessions} onAdd={(session) => handleAddToSession(`agenda-${i}`, session)} isAdded={!!addedToSession[`agenda-${i}`]} addedToSession={addedToSession[`agenda-${i}`]} />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-amber-600 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>Not discussed</span>
                            <AddToSessionButton sessions={insights.upcomingSessions} onAdd={(session) => handleAddToSession(`agenda-${i}`, session)} isAdded={!!addedToSession[`agenda-${i}`]} addedToSession={addedToSession[`agenda-${i}`]} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* General Themes */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center">
                      <svg className="w-3 h-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                    </div>
                    <h4 className="text-sm font-medium text-slate-700">General Themes</h4>
                    <span className="text-xs text-slate-400">Organic topics that emerged</span>
                  </div>
                  <div className="space-y-2 pl-7">
                    {insights.generalThemes.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50">
                        <div className="flex-1 min-w-0"><p className="text-sm text-slate-800">{item.name}</p></div>
                        <div className="flex items-center gap-2">
                            <TimeSpentWithChart timeSpent={item.timeSpent} itemName={item.name} allTopics={allTopicsForChart} totalDuration={totalDiscussedTime} />
                            <AddToSessionButton sessions={insights.upcomingSessions} onAdd={(session) => handleAddToSession(`theme-${i}`, session)} isAdded={!!addedToSession[`theme-${i}`]} addedToSession={addedToSession[`theme-${i}`]} />
                          </div>
                      </div>
                    ))}
                  </div>
                </div>
                    </>
                  );
                })()}

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>{insights.agendaItems.filter(a => a.discussed).length + insights.goalsDiscussed.filter(g => g.discussed).length} topics covered</span>
                  <span>{insights.agendaItems.filter(a => !a.discussed).length + insights.goalsDiscussed.filter(g => !g.discussed).length} items remaining</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-800 mb-1">Discussion Topics</h3>
                <p className="text-xs text-slate-500 mb-4">Topics ranked by discussion frequency</p>
                <div className="space-y-2">{insights.topics.map((t, i) => <TopicCard key={t.name} topic={t} rank={i + 1} onClick={() => handleTopicClick(t)} />)}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-800 mb-1">✨ Breakthrough Moments</h3>
                <p className="text-xs text-slate-500 mb-4">Key realizations and insights from the session</p>
                <div className="space-y-3">{insights.keyInsights.map((ins, i) => <InsightCard key={i} insight={ins} />)}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-800 mb-1">📋 Actions Detected</h3>
                <p className="text-xs text-slate-500 mb-4">Action items mentioned during the session</p>
                <div className="space-y-3">{insights.detectedActions.map((action, i) => <DetectedActionCard key={i} action={action} onAdd={() => handleAddAction(i)} isAdded={addedActions[i]} />)}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-800 mb-1">🤝 Agreements Detected</h3>
                <p className="text-xs text-slate-500 mb-4">Agreements made during the session</p>
                <div className="space-y-3">{insights.detectedAgreements.map((agreement, i) => <DetectedAgreementCard key={i} agreement={agreement} onAdd={() => handleAddAgreement(i)} isAdded={addedAgreements[i]} />)}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-800 mb-1">🚧 Blockers Detected</h3>
                <p className="text-xs text-slate-500 mb-4">Obstacles preventing progress — click to see unblocking needs</p>
                <div className="space-y-3">{insights.detectedBlockers.map((b, i) => <DetectedBlockerCard key={i} blocker={b} />)}</div>
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3 mb-3"><div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center"><span className="text-xs text-white">J</span></div><h3 className="font-semibold text-slate-800 text-sm">Jim Hodapp</h3></div>
                <div className="space-y-2">{insights.keyQuestions.jim.map((q, i) => <QuestionCard key={i} question={q} onClick={() => handleQuestionClick(q, true)} />)}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3 mb-3"><div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center"><span className="text-xs text-white">M</span></div><h3 className="font-semibold text-slate-800 text-sm">Mark Richardson</h3></div>
                <div className="space-y-2">{insights.keyQuestions.mark.map((q, i) => <QuestionCard key={i} question={q} onClick={() => handleQuestionClick(q, false)} />)}</div>
              </div>
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div><h3 className="text-base font-semibold text-slate-800">Session Transcript</h3><p className="text-xs text-slate-500">84:00 duration</p></div>
                <button className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg">Export</button>
              </div>
              <div className="relative mb-4">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search transcript..."
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {transcriptSearch && (
                  <button 
                    onClick={() => setTranscriptSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="space-y-3 px-6 py-3 bg-slate-50 rounded-lg overflow-y-auto overflow-x-hidden" style={{ minHeight: '500px', maxHeight: '500px' }}>
                {insights.transcriptExcerpts
                  .filter(msg => !transcriptSearch || msg.text.toLowerCase().includes(transcriptSearch.toLowerCase()) || msg.name.toLowerCase().includes(transcriptSearch.toLowerCase()))
                  .map((msg, i) => (
                  <TranscriptMessage key={i} message={msg} isCoach={msg.speaker === 'jim'} sessions={insights.upcomingSessions} onContinue={(session) => handleContinueTranscript(i, session)} isContinued={!!continuedTranscriptMessages[i]} addedToSession={continuedTranscriptMessages[i]} />
                ))}
                {transcriptSearch && insights.transcriptExcerpts.filter(msg => msg.text.toLowerCase().includes(transcriptSearch.toLowerCase()) || msg.name.toLowerCase().includes(transcriptSearch.toLowerCase())).length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">No messages found matching "{transcriptSearch}"</div>
                )}
              </div>
              <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <p className="text-sm text-indigo-800 font-medium mb-1">Continue this conversation</p>
                <p className="text-xs text-indigo-600">Use AI to explore topics from this session further</p>
              </div>
            </div>
          )}
        </div>
      )}

      {mainTab !== 'debrief' && (
        <div className="px-4 py-8 text-center text-slate-500 text-sm">Switch to <strong>Debrief</strong> tab to see session analysis</div>
      )}

      <ThreadDrawer question={selectedQuestion} onClose={closeDrawer} isJim={isQuestionFromJim} />
      <TopicThreadDrawer topic={selectedTopic} onClose={closeTopicDrawer} />
    </div>
  );
}
