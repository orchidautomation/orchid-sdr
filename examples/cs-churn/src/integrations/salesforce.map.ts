export default {
  account: {
    id: "Account.Id",
    name: "Account.Name",
    tier: "Account.Account_Tier__c",
    acv: "Account.ACV__c",
    planYear: "Account.Plan_Year__c",
    contractStart: "Account.Contract_Start__c",
    renewalDate: "Account.Renewal_Date__c",
    multiYear: "Account.Multi_Year__c",
    csm: "Account.CSM__c",
    ae: "Account.Owner.Name",
    healthScore: "Account.Health_Score__c",
    lastQbrDate: "Account.Last_QBR_Date__c",
    executiveSponsor: "Account.Executive_Sponsor__c",
    champion: "Account.Champion__c",
  },
  related: {
    opportunities: "Opportunity WHERE AccountId = :accountId ORDER BY CloseDate DESC LIMIT 5",
    tasks: "Task WHERE AccountId = :accountId ORDER BY CreatedDate DESC LIMIT 10",
    cases: "Case WHERE AccountId = :accountId AND IsClosed = false",
  },
};
