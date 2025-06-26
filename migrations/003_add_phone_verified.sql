-- Add phone_verified column to suppliers table
ALTER TABLE suppliers 
ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE; 