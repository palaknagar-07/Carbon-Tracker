import React, { useMemo, useState } from 'react';
import './FaqPage.css';

const FAQ_ITEMS = [
  {
    id: 'eco-points',
    category: 'Points & XP',
    question: 'What are Eco Points?',
    answer:
      'Eco Points measure the environmental impact of your commute choices. Every time you log a greener trip, you earn points based on how much carbon you saved compared to taking the same trip by car.'
  },
  {
    id: 'eco-points-calculated',
    category: 'Points & XP',
    question: 'How are Eco Points calculated?',
    answer:
      'Eco Points are calculated from the carbon saved versus driving alone. The more carbon your trip avoids, the more points you earn. Verified trips may also receive bonus points depending on the validation method.'
  },
  {
    id: 'different-points',
    category: 'Points & XP',
    question: 'Why do I earn different points for different trips?',
    answer:
      'Points can vary based on distance, transport mode, and whether the trip was manually logged or validated through route or GPS tracking. Longer and lower-emission trips usually earn more.'
  },
  {
    id: 'xp-what',
    category: 'Points & XP',
    question: 'What is XP?',
    answer:
      'XP, or experience points, powers your level progression in the app. It reflects your consistency and activity over time and helps unlock a stronger sense of progress through levels and rewards.'
  },
  {
    id: 'xp-how',
    category: 'Points & XP',
    question: 'How does XP work?',
    answer:
      'You earn XP when you log eco-friendly commutes. Some actions, like maintaining a streak or unlocking badges, can also contribute to your XP growth.'
  },
  {
    id: 'level-requirements',
    category: 'Points & XP',
    question: 'What are the level requirements?',
    answer:
      'Level 1 starts at 0 XP. Level 2 starts at 1000 XP. Level 3 starts at 2500 XP. Level 4 starts at 5500 XP. Level 5 starts at 11500 XP.'
  },
  {
    id: 'points-vs-xp',
    category: 'Points & XP',
    question: 'What is the difference between Eco Points and XP?',
    answer:
      'Eco Points represent your total environmental contribution. XP is used for level progression and gamified rewards. In short, points reflect impact, while XP reflects progression.'
  },
  {
    id: 'streak-what',
    category: 'Streaks & Rewards',
    question: 'What is a streak?',
    answer:
      'A streak tracks how many consecutive days you log at least one qualifying commute. It is designed to reward consistency and help build long-term eco-friendly habits.'
  },
  {
    id: 'streak-help',
    category: 'Streaks & Rewards',
    question: 'How does maintaining a streak help?',
    answer:
      'Maintaining a streak encourages regular sustainable choices. It can help you earn streak bonuses, unlock badges, and stay motivated by showing your consistency over time.'
  },
  {
    id: 'streak-increase',
    category: 'Streaks & Rewards',
    question: 'When does my streak increase?',
    answer:
      'Your streak increases when you log a qualifying commute on consecutive days. Logging at least one trip each day helps keep it active.'
  },
  {
    id: 'streak-reset',
    category: 'Streaks & Rewards',
    question: 'Can my streak reset?',
    answer:
      'Yes. If you miss a day without logging a qualifying commute, your streak can reset. You can always start building it again.'
  },
  {
    id: 'badges',
    category: 'Streaks & Rewards',
    question: 'What badges can I unlock?',
    answer:
      'Badges reward important milestones, such as saving a certain amount of carbon, maintaining streaks, logging specific commute types, or improving your leaderboard rank.'
  },
  {
    id: 'carbon-saved',
    category: 'Tracking & Accuracy',
    question: 'How is carbon saved calculated?',
    answer:
      'Carbon saved is calculated by comparing the emissions from your chosen travel mode with the emissions of taking a car for the same distance.'
  },
  {
    id: 'why-car',
    category: 'Tracking & Accuracy',
    question: 'Why is my trip compared to a car?',
    answer:
      'A car is used as the baseline because it provides a clear and familiar reference point for understanding how much carbon your greener trip avoided.'
  },
  {
    id: 'todays-emissions',
    category: 'Tracking & Accuracy',
    question: 'What does “Today’s emissions” mean?',
    answer:
      'Today’s emissions show the total carbon emitted from all trips you logged today. It helps you understand your day’s overall transport footprint.'
  },
  {
    id: 'weekly-summary',
    category: 'Tracking & Accuracy',
    question: 'Why does my weekly summary look different from my total stats?',
    answer:
      'Your weekly summary only reflects recent activity within the current reporting window, while total stats show your all-time progress since you started using the app.'
  },
  {
    id: 'manual-tracked',
    category: 'Tracking & Accuracy',
    question: 'Do manual and tracked trips work the same way?',
    answer:
      'Both can count toward your progress, but tracked or validated trips are treated as stronger evidence. That can affect validation bonuses and how confidently the trip is scored.'
  },
  {
    id: 'validation-bonuses',
    category: 'Tracking & Accuracy',
    question: 'What are validation bonuses?',
    answer:
      'Validation bonuses are extra rewards given when a trip is supported by stronger evidence, such as route or GPS data. GPS trips can earn different bonus levels depending on validation quality, so the bonus is not always the same on every tracked trip.'
  },
  {
    id: 'badge-not-unlocked',
    category: 'Streaks & Rewards',
    question: 'Why didn’t I unlock a badge yet?',
    answer:
      'Badges unlock only when you reach specific milestones. If you are close, keep logging trips consistently and your badge should appear once the requirement is met.'
  },
  {
    id: 'rounded-values',
    category: 'Tracking & Accuracy',
    question: 'Why are some values rounded?',
    answer:
      'Some carbon, point, and XP values are rounded to keep the app easier to read and understand while still giving a meaningful view of your progress.'
  },
  {
    id: 'short-trips',
    category: 'Streaks & Rewards',
    question: 'Do short trips still matter?',
    answer:
      'Yes. Short trips add up over time. Replacing even small car trips with walking, cycling, or public transport can make a meaningful difference.'
  },
  {
    id: 'level-up-faster',
    category: 'Streaks & Rewards',
    question: 'How can I level up faster?',
    answer:
      'The best way is to log eco-friendly commutes consistently, maintain your streak, and use lower-emission travel modes whenever possible.'
  },
  {
    id: 'without-gps',
    category: 'Account & Privacy',
    question: 'Can I use the app without GPS tracking?',
    answer:
      'Yes. You can still log trips manually. GPS or route validation simply helps improve trip accuracy and may unlock stronger validation bonuses when the recorded trip quality is good.'
  },
  {
    id: 'trip-history',
    category: 'Account & Privacy',
    question: 'Does the app store my trip history?',
    answer:
      'Your trip history may be stored so the app can calculate your stats, streaks, rewards, and summaries over time.'
  },
  {
    id: 'location-public',
    category: 'Account & Privacy',
    question: 'Is my location shared publicly?',
    answer:
      'Your precise trip details should not be publicly visible unless the product explicitly says so. Public-facing features such as leaderboards should focus on rankings and aggregate stats instead of sensitive trip data.'
  },
  {
    id: 'leaderboard-rank',
    category: 'Account & Privacy',
    question: 'How is leaderboard rank calculated?',
    answer:
      'Leaderboard rank is based on your recorded activity and performance in the app, such as points, carbon savings, or other gamified metrics used by the platform.'
  },
  {
    id: 'why-commuting-matters',
    category: 'Account & Privacy',
    question: 'Why does eco-friendly commuting matter?',
    answer:
      'Choosing lower-emission transport reduces carbon output, improves air quality, and supports healthier, more sustainable cities. Every trip is a small action that contributes to a bigger impact.'
  }
];

const CATEGORIES = ['All', ...new Set(FAQ_ITEMS.map((item) => item.category))];

const FaqPage = () => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [openItems, setOpenItems] = useState(() => new Set(['eco-points', 'xp-how', 'streak-help']));

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return FAQ_ITEMS.filter((item) => {
      const matchesCategory =
        activeCategory === 'All' || item.category === activeCategory;
      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;

      const haystack = `${item.question} ${item.answer} ${item.category}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeCategory, query]);

  const groupedItems = useMemo(() => {
    return visibleItems.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [visibleItems]);

  const toggleItem = (id) => {
    setOpenItems((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="content faq-page">
      <section className="faq-hero">
        <div className="faq-hero-copy">
          <div className="section-title">Help Center</div>
          <h2>Frequently Asked Questions</h2>
          <p>
            Questions about points, XP, streaks, tracking, or privacy? Start here.
            This guide explains how the app works in plain language.
          </p>
        </div>
        <div className="faq-hero-badge" aria-hidden="true">❓</div>
      </section>

      <section className="faq-controls">
        <label className="faq-search-label" htmlFor="faq-search">
          Search questions
        </label>
        <input
          id="faq-search"
          className="input faq-search"
          type="search"
          placeholder="Search points, XP, streaks, tracking..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="faq-category-row" aria-label="FAQ categories">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={`faq-chip ${activeCategory === category ? 'active' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {visibleItems.length === 0 ? (
        <section className="faq-empty">
          <h3>No matching questions</h3>
          <p>Try a different search term or switch back to all categories.</p>
        </section>
      ) : null}

      {Object.entries(groupedItems).map(([category, items]) => (
        <section key={category} className="faq-section">
          <div className="section-title">{category}</div>
          <div className="faq-list">
            {items.map((item) => {
              const isOpen = openItems.has(item.id);
              return (
                <article key={item.id} className={`faq-item ${isOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="faq-question"
                    onClick={() => toggleItem(item.id)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${item.id}`}
                  >
                    <span>{item.question}</span>
                    <span className="faq-toggle" aria-hidden="true">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  <div
                    id={`faq-answer-${item.id}`}
                    className="faq-answer"
                    hidden={!isOpen}
                  >
                    <p>{item.answer}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className="faq-footer-card">
        <h3>Still need help?</h3>
        <p>
          If something in your stats looks confusing, compare your dashboard,
          trip details, and profile rewards together. They are designed to explain
          the same journey from different angles.
        </p>
      </section>
    </div>
  );
};

export default FaqPage;
