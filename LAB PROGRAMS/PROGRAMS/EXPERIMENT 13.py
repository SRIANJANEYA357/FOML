import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

data = pd.read_csv("car_price_prediction.csv")

print(data.head())

data = data.fillna("Unknown")

for column in data.columns:
    data[column] = data[column].astype(str)

for column in data.columns:
    encoder = LabelEncoder()
    data[column] = encoder.fit_transform(data[column])

X = data.drop("Price", axis=1)
y = data["Price"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

model = RandomForestRegressor(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)

y_pred = model.predict(X_test)

print("\nMean Absolute Error:")
print(mean_absolute_error(y_test, y_pred))

print("\nMean Squared Error:")
print(mean_squared_error(y_test, y_pred))

print("\nR2 Score:")
print(r2_score(y_test, y_pred))


sample = X_test.iloc[[0]]

prediction = model.predict(sample)

print("\nPredicted Price:")
print(prediction[0])
