IF OBJECT_ID(N'dbo.DealContactLinks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DealContactLinks
    (
        DealId BIGINT NOT NULL,
        ContactId BIGINT NOT NULL,
        CONSTRAINT PK_DealContactLinks PRIMARY KEY (DealId, ContactId),
        CONSTRAINT FK_DealContactLinks_Deals
            FOREIGN KEY (DealId) REFERENCES dbo.Deals(Id) ON DELETE CASCADE,
        CONSTRAINT FK_DealContactLinks_Contacts
            FOREIGN KEY (ContactId) REFERENCES dbo.Contacts(ContactId) ON DELETE CASCADE
    );
END;

INSERT INTO dbo.DealContactLinks (DealId, ContactId)
SELECT d.Id, d.ContactId
FROM dbo.Deals d
WHERE d.ContactId IS NOT NULL
  AND NOT EXISTS
  (
      SELECT 1
      FROM dbo.DealContactLinks l
      WHERE l.DealId = d.Id
        AND l.ContactId = d.ContactId
  );
