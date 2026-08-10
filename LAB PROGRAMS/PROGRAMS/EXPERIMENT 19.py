import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report


data = pd.read_csv("loan_data.csv")

print(data.head())


data.drop("Loan_ID", axis=1, inplace=True)


categorical_columns = data.select_dtypes(include=["object", "string"]).columns

numerical_columns = data.select_dtypes(include=["number"]).columns


for column in categorical_columns:
    data[column] = data[column].fillna(data[column].mode()[0])


for column in numerical_columns:
    data[column] = data[column].fillna(data[column].median())


encoder = LabelEncoder()

for column in categorical_columns:
    data[column] = encoder.fit_transform(data[column].astype(str))


print("\nAfter Encoding:")
print(data.head())


X = data.drop("Loan_Status", axis=1)

y = data["Loan_Status"]


y = encoder.fit_transform(y)


X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)


scaler = StandardScaler()

X_train = scaler.fit_transform(X_train)

X_test = scaler.transform(X_test)


model = GaussianNB()

model.fit(X_train, y_train)


y_pred = model.predict(X_test)


print("\nAccuracy:")
print(accuracy_score(y_test, y_pred) * 100)


print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))


print("\nClassification Report:")
print(classification_report(y_test, y_pred))


sample = X_test[0].reshape(1, -1)

prediction = model.predict(sample)


print("\nPrediction:")

if prediction[0] == 1:
    print("Loan Approved")
else:
    print("Loan Rejected")
