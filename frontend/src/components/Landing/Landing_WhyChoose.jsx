export default function WhyChoose() {
  return (
    <section className="ud-why">
      <div className="ud-why-inner">
        <h2 className="ud-why-title">Why choose Aspect for your property maintenance?</h2>

        <div className="ud-why-grid">
          {/* 1 */}
          <article className="ud-why-card">
            <div className="ud-why-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 3h6m-6 0a2 2 0 0 0-2 2v1h10V5a2 2 0 0 0-2-2m-6 0h6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path d="M7 6h10v14H7V6Z" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M9.5 12l1.5 1.5L14.5 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h3 className="ud-why-heading">Service support</h3>

            <p className="ud-why-text">
              The best way of resolving a problem quickly is by seeing it. Our Aspect Service Support Managers have extensive
              knowledge of every trade. Offering advice, checking workmanship and managing your expectations, this agile
              approach gives you the service of a local business but with the resources and reliability of a large team.
            </p>

            <a className="ud-why-link" href="https://www.aspect.co.uk/about-us/" target="_blank" rel="noreferrer">
              Our support
            </a>
          </article>

          {/* 2 */}
          <article className="ud-why-card">
            <div className="ud-why-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 8v5l3 2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>

            <h3 className="ud-why-heading">24 hours a day</h3>

            <p className="ud-why-text">
              Aspect being one of London’s largest team of property maintenance experts, we never rest. With so many tradesmen
              out on the road every day, you can be sure that when you need us the most we’re never going to be that far away.
              The Aspect booking team is ready to take your call any time of day or night, every day of the year. We’re here to help!
            </p>

            <a className="ud-why-link" href="https://www.aspect.co.uk/about-us/" target="_blank" rel="noreferrer">
              Our coverage
            </a>
          </article>

          {/* 3 */}
          <article className="ud-why-card">
            <div className="ud-why-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 15a4 4 0 0 1-4 4H9l-4 3v-3a4 4 0 0 1-2-3.5V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M7.5 8.5h9M7.5 12h6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <h3 className="ud-why-heading">Customer service</h3>

            <p className="ud-why-text">
              Our aim is to make booking an Aspect tradesperson for any property maintenance work as easy and stress free as possible.
              We’re dedicated to reliably delivering, not just promising. Keeping you informed at every step, we really care about your experience.
              We measure success by how happy you are with our service.
            </p>

            <a className="ud-why-link" href="https://www.aspect.co.uk/about-us/" target="_blank" rel="noreferrer">
              Our promise
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
