export default {
  accountKey: "account_id",
  tables: {
    eligibility: "eligibility_files",
    users: "users",
    careEpisodes: "care_episodes",
    springLifeEvents: "springlife_events",
    adminSessions: "admin_sessions",
  },
  metrics: {
    registrationRate: "registered_users / eligible_lives",
    utilizationRate: "users_with_care_episode_12mo / registered_users",
    springLifeDauTrend: "member-facing app activity, trailing 30d vs prior 30d",
    adminLoginCadence: "latest SpringWorks admin login and 90d session count",
    modalityMix: "therapy / coaching / medication / self-guided distribution",
  },
};
